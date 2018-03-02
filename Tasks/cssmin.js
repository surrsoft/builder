/* eslint-disable no-invalid-self */
'use strict';

const
   path = require('path'),
   fs = require('fs-extra'),
   util = require('util'),
   CleanCSS = require('clean-css'),
   helpers = require('../lib/helpers'),
   logger = require('../lib/logger').logger();

module.exports = function(grunt) {

   const getAvailableFiles = async(filesArray) => {
      const promises = filesArray.map(async(filePath) => {
         const exists = await fs.pathExists(filePath);
         if (!exists) {
            logger.warning({
               message: 'Source file not found',
               filePath: helpers.prettifyPath(filePath)
            });
            return null;
         }
         return filePath;
      });
      const results = await Promise.all(promises);
      return results.filter(currentPath => !!currentPath);
   };

   const minifyCSS = async(self, file, applicationRoot) => {
      const
         options = self.options({
            rebase: false,
            report: 'min',
            sourceMap: false
         }),
         availableFiles = await getAvailableFiles(file.src),
         fileSourcePath = helpers.prettifyPath(availableFiles.join(','));

      let
         compiled = '',
         errors = '';

      options.rebaseTo = path.dirname(file.dest);

      try {
         compiled = new CleanCSS(options).minify(availableFiles);

         if (compiled.errors.length) {
            errors = compiled.errors.toString();
            logger.warning({
               message: `Error while minifying css: ${errors}`,
               filePath: fileSourcePath
            });
         }

         if (compiled.warnings.length) {
            errors = compiled.warnings.toString();
            logger.error({
               message: `Error while minifying css: ${errors}`,
               filePath: fileSourcePath
            });
         }

         if (options.debug) {
            logger.debug(util.format(compiled.stats));
         }
      } catch (err) {
         logger.error({
            message: 'CSS minification failed',
            error: err,
            filePath: availableFiles.toString()
         });
      }

      let
         compiledCssString = errors ? `/*${errors}*/` : compiled.styles;

      const
         cssStyles = await Promise.all(availableFiles.map(filePath => fs.readFile(filePath))),
         unCompiledCssString = cssStyles.join('');

      self.size.before += unCompiledCssString.length;

      if (options.sourceMap) {
         compiledCssString += `\n/*# sourceMappingURL=${path.basename(file.dest)}.map */`;
         await fs.writeFile(`${file.dest}.map`, compiled.sourceMap.toString());
         self.created.maps++;
         logger.debug(`File "${file.dest}.map" created`);
      }

      if (self.data.splittedCore) {
         const
            currentNodePath = helpers.removeLeadingSlash(file.dest.replace(applicationRoot, '').replace('.min.css', '.css')),
            currentNode = self.nodes.filter(function(node) {
               return self.mDeps.nodes[node].path === currentNodePath;
            });
         if (currentNode.length > 0) {
            currentNode.forEach(function(node) {
               self.mDeps.nodes[node].path = file.dest;
            });
         }
      }

      await fs.writeFile(file.dest, compiledCssString);
      self.created.files++;
      self.size.after += compiledCssString.length;
      logger.debug(`File "${file.dest}" created.`);

   };

   grunt.registerMultiTask('cssmin', 'Minify CSS', async function() {
      const
         self = this,
         applicationRoot = path.join(self.data.root, self.data.application).replace(/\\/g, '/'),
         mDepsPath = helpers.prettifyPath(path.join(applicationRoot, 'resources/module-dependencies.json')),
         done = self.async();

      self.created = {
         maps: 0,
         files: 0
      };
      self.size = {
         before: 0,
         after: 0
      };

      try {
         self.mDeps = await fs.readJson(mDepsPath);
         self.nodes = Object.keys(self.mDeps.nodes);
      } catch (err) {
         logger.error({
            message: `Can't read module-dependencies`,
            error: err,
            filePath: mDepsPath
         });
      }

      //выполняем минификацию css
      await Promise.all(self.files.map(file => minifyCSS(self, file, applicationRoot)));

      if (self.data.splittedCore) {
         //пишем module-dependencies, если производили в нём изменения
         await fs.writeJson(mDepsPath, self.mDeps);
      }

      if (self.created.maps > 0) {
         logger.info(`${self.created.maps} source${grunt.util.pluralize(self.files.length, 'map/maps')} created.`);
      }

      if (self.created.files > 0) {
         logger.info(`${self.created.files} ${grunt.util.pluralize(self.files.length, 'file/files')} created. `);
      } else {
         logger.warning('No files created.');
      }
      done();
   });
};
