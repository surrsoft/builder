/* eslint-disable no-invalid-this */
'use strict';

const
   path = require('path'),
   util = require('util'),
   CleanCSS = require('clean-css'),
   helpers = require('../lib/helpers'),
   logger = require('../lib/logger').logger();

module.exports = function(grunt) {
   const getAvailableFiles = function(filesArray) {
      return filesArray.filter(function(filepath) {
         if (!grunt.file.exists(filepath)) {
            logger.warning({
               message: 'Source file not found',
               filepath: helpers.prettifyPath(filepath)
            });
            return false;
         }
         return true;
      });
   };

   grunt.registerMultiTask('cssmin', 'Minify CSS', function() {
      const
         splittedCore = this.data.splittedCore,
         applicationRoot = path.join(this.data.root, this.data.application).replace(/\\/g, '/'),
         mDepsPath = helpers.prettifyPath(path.join(applicationRoot, 'resources/module-dependencies.json')),
         created = {
            maps: 0,
            files: 0
         },
         size = {
            before: 0,
            after: 0
         };

      //Нам необходимо поменять пути до узлов css на минифицированные
      let
         mDeps,
         nodes;

      try {
         mDeps = JSON.parse(grunt.file.read(mDepsPath));
         nodes = Object.keys(mDeps.nodes);
      } catch (err) {
         logger.error({
            message: 'Can\'t read module-dependencies',
            error: err,
            filepath: mDepsPath
         });
      }

      this.files.forEach(function(file) {
         const
            options = this.options({
               rebase: false,
               report: 'min',
               sourceMap: false
            }),
            availableFiles = getAvailableFiles(file.src),
            fileSourcePath = helpers.prettifyPath(availableFiles.join(''));

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
            unCompiledCssString = availableFiles.map(function(currentFile) {
               return grunt.file.read(currentFile);
            }).join('');

         size.before += unCompiledCssString.length;

         if (options.sourceMap) {
            compiledCssString += '\n/*# sourceMappingURL=' + path.basename(file.dest) + '.map */';
            grunt.file.write(file.dest + '.map', compiled.sourceMap.toString());
            created.maps++;
            logger.debug('File "' + file.dest + '.map" created');
         }

         if (splittedCore) {
            const
               currentNodePath = helpers.removeLeadingSlash(file.dest.replace(applicationRoot, '').replace('.min.css', '.css')),
               currentNode = nodes.filter(function(node) {
                  return mDeps.nodes[node].path === currentNodePath;
               });
            if (currentNode.length > 0) {
               currentNode.forEach(function(node) {
                  mDeps.nodes[node].path = file.dest;
               });
            }
         }

         grunt.file.write(file.dest, compiledCssString);
         created.files++;
         size.after += compiledCssString.length;
         logger.debug('File "' + file.dest + '" created ');

      }, this);

      if (splittedCore) {
         //пишем module-dependencies
         grunt.file.write(mDepsPath, JSON.stringify(mDeps, null, 3));
      }

      if (created.maps > 0) {
         logger.info(created.maps + ' source' + grunt.util.pluralize(this.files.length, 'map/maps') + ' created.');
      }

      if (created.files > 0) {
         logger.info(created.files + ' ' + grunt.util.pluralize(this.files.length, 'file/files') + ' created. ');
      } else {
         logger.warning('No files created.');
      }
   });
};
