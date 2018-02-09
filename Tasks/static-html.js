'use strict';

const path = require('path'),
   fs = require('fs'),
   helpers = require('../lib/helpers'),
   convertHtmlTmpl = require('../lib/convert-html-tmpl'),
   parseJsComponent = require('../lib/parse-js-component'),
   logger = require('../lib/logger').logger(),
   generateStaticHtmlForJs = require('../lib/generate-static-html-for-js');

function convertTmpl(resourcesRoot, filePattern, cb) {
   helpers.recurse(resourcesRoot, function(fullPath, callback) {
      // фильтр по файлам .html.tmpl
      if (!helpers.validateFile(fullPath, filePattern)) {
         setImmediate(callback);
         return;
      }

      helpers.readFile(fullPath, function(err, html) {
         if (err) {
            logger.error(`Ошибка чтения файла ${fullPath}: ${err}`);
            setImmediate(callback);
            return;
         }

         convertHtmlTmpl(html, fullPath)
            .then(
               result => {
                  const newFullPath = fullPath.replace(/\.tmpl$/, '');

                  // если файл уже есть, удалим
                  if (helpers.existsSync(newFullPath)) {
                     helpers.unlinkSync(newFullPath);
                  }

                  // создадим файл с новым содержимым
                  helpers.writeFile(newFullPath, result.toString(), callback);
               },
               error => {
                  logger.error({
                     message: 'Ошибка при обработке шаблона',
                     error: error,
                     filePath: fullPath
                  });
                  setImmediate(callback);
               }
            );
      });
   }, cb);
}

module.exports = function(grunt) {
   const servicesPath = (grunt.option('services_path') || '').replace(/["']/g, '');
   const userParams = grunt.option('user_params') || false;
   const globalParams = grunt.option('global_params') || false;

   grunt.registerMultiTask('html-tmpl', 'Generate static html from .html.tmpl files', function() {
      logger.debug('Запускается задача html-tmpl.');
      const start = Date.now(),
         done = this.async(),
         root = this.data.root,
         application = this.data.application,
         applicationRoot = path.join(root, application),
         resourcesRoot = path.join(applicationRoot, 'resources'),
         filePattern = this.data.filePattern;

      convertTmpl(resourcesRoot, filePattern, function(err) {
         if (err) {
            logger.error({error: err});
         }

         logger.debug(`Duration: ${(Date.now() - start) / 1000} sec`);
         done();
      });
   });

   grunt.registerMultiTask('static-html', 'Generate static html from modules', function() {
      logger.debug('Запускается задача static-html.');
      const
         start = Date.now(),
         done = this.async(),
         root = this.data.root,
         application = this.data.application,
         applicationRoot = path.join(root, application),
         resourcesRoot = path.join(applicationRoot, 'resources'),
         patterns = this.data.src,
         oldHtml = grunt.file.expand({cwd: applicationRoot}, this.data.html),
         modulesOption = (grunt.option('modules') || '').replace('"', ''),
         forPresentationService = (grunt.option('includes') !== undefined) ? !grunt.option('includes') : false;

      if (!modulesOption) {
         logger.error('Parameter "modules" not found');
         return;
      }
      const pathsModules = grunt.file.readJSON(modulesOption);
      if (!Array.isArray(pathsModules)) {
         logger.error('Parameter "modules" incorrect');
         return;
      }
      const modules = new Map();
      for (let pathModule of pathsModules) {
         modules.set(path.basename(pathModule), pathModule);
      }

      let contents = {};
      try {
         contents = grunt.file.readJSON(path.join(resourcesRoot, 'contents.json'));
      } catch (err) {
         logger.warning({
            message: 'Error while requiring contents.json',
            error: err
         });
      }

      if (oldHtml && oldHtml.length) {
         let start = Date.now();
         oldHtml.forEach(function(file) {
            const filePath = path.join(applicationRoot, file);
            try {
               fs.unlinkSync(path.join(applicationRoot, file));
            } catch (err) {
               logger.warning({
                  message: 'Can\'t delete old html',
                  filePath: filePath,
                  error: err
               });
            }
         });
         logger.debug(`Удаление ресурсов завершено(${(Date.now() - start) / 1000} sec)`);
      }

      const config = {
         root: root,
         application: application,
         servicesPath: servicesPath,
         userParams: userParams,
         globalParams: globalParams
      };

      helpers.recurse(applicationRoot, function(file, callback) {
         if (helpers.validateFile(path.relative(applicationRoot, file), patterns)) {
            fs.readFile(file, (err, text) => {
               if (err) {
                  logger.error({
                     error: err
                  });
                  return callback();
               }

               let componentInfo = {};
               try {
                  componentInfo = parseJsComponent(text.toString());
               } catch (error) {
                  return callback(error);
               }

               generateStaticHtmlForJs(file, componentInfo, contents, config, modules, forPresentationService)
                  .then(
                     result => {
                        if (result) {
                           const outputPath = path.join(applicationRoot, result.outFileName);
                           helpers.writeFile(outputPath, result.text, callback);
                        } else {
                           callback();
                        }
                     },
                     error => {
                        logger.error({
                           message: 'Ошибка при генерации статической html для JS',
                           filePath: file,
                           error: error
                        });
                        callback();
                     }
                  );
            });
         } else {
            callback();
         }
      }, function(err) {
         if (err) {
            logger.error({
               error: err
            });
         }

         try {
            const sorted = helpers.sortObject(contents);

            grunt.file.write(path.join(resourcesRoot, 'contents.json'), JSON.stringify(sorted, null, 2));
            grunt.file.write(path.join(resourcesRoot, 'contents.js'), 'contents=' + JSON.stringify(sorted));
         } catch (error) {
            logger.error({
               error: error
            });
         }

         logger.debug(`Duration: ${(Date.now() - start) / 1000} sec`);

         done();
      });
   });
};
