'use strict';

const path = require('path'),
   fs = require('fs-extra'),
   helpers = require('../lib/helpers'),
   convertHtmlTmpl = require('../lib/convert-html-tmpl'),
   parseJsComponent = require('../lib/parse-js-component'),
   wsPathCalculator = require('../lib/ws-path-calculator'),
   logger = require('../lib/logger').logger(),
   generateStaticHtmlForJs = require('../lib/generate-static-html-for-js');

function convertTmpl(splittedCore, resourcesRoot, filePattern, componentsProperties, cb) {
   async function generateMarkup(html, fullPath, setImmediate, callback) {
      let result;
      try {
         result = await convertHtmlTmpl.generateMarkup(html, fullPath, componentsProperties, splittedCore);
      } catch (error) {
         logger.error({
            message: 'Ошибка при обработке шаблона',
            error: error,
            filePath: fullPath
         });
         setImmediate(callback);
      }

      const newFullPath = fullPath.replace(/\.tmpl$/, '');

      // создадим файл с новым содержимым
      await fs.writeFile(newFullPath, result.toString(), callback);
   }

   helpers.recurse(resourcesRoot, async function(fullPath, callback) {
      // фильтр по файлам .html.tmpl
      if (!helpers.validateFile(fullPath, filePattern)) {
         setImmediate(callback);
         return;
      }

      let html, result, routeTmpl;

      try {
         routeTmpl = global.requirejs('tmpl!Controls/Application/Route');
         global.requirejs('Controls/Application'); // eslint-disable-line no-unused-vars
      } catch (e) {
         logger.error('Task html-tmpl нашел *.html.tmpl файл, но не может его сконвертировать. Добавьте модуль Controls в проект.');
         setImmediate(callback);
         return;
      }

      try {
         html = await fs.readFile(fullPath);
      } catch (error) {
         logger.error(`Ошибка чтения файла ${fullPath}: ${error}`);
         setImmediate(callback);
         return;
      }

      try {
         result = await convertHtmlTmpl.generateFunction(html, fullPath, componentsProperties);
      } catch (error) {
         logger.error({
            message: 'Ошибка при обработке шаблона',
            error: error,
            filePath: fullPath
         });
         setImmediate(callback);
         return;
      }

      const tmplFunc = result.tmplFunc.toString();
      const newFullPath = fullPath.replace(/\.html\.tmpl$/, '.new.html');

      const routeResult = routeTmpl({
         application: 'Controls/Application',
         wsRoot: wsPathCalculator.getWsRoot(splittedCore),
         resourceRoot: wsPathCalculator.getResources(splittedCore),
         _options: {
            builder: tmplFunc,
            dependencies: result.dependencies.map(v => `'${v}'`).toString()
         }
      });

      if (typeof routeResult === 'string') {
         await fs.writeFile(newFullPath, routeResult);
         await generateMarkup(html, fullPath, setImmediate);
         callback();
      } else {
         routeResult
            .addCallback(async function(res) {
               await fs.writeFile(newFullPath, res);
               await generateMarkup(html, fullPath, setImmediate);
               callback();
            })
            .addErrback(function(error) {
               logger.error({
                  message: 'Ошибка при обработке шаблона',
                  error: error,
                  filePath: fullPath
               });
               setImmediate(callback);
            });
      }
   }, cb);
}

module.exports = function(grunt) {
   const servicesPath = (grunt.option('services_path') || '').replace(/["']/g, '');
   const userParams = grunt.option('user_params') || false;
   const globalParams = grunt.option('global_params') || false;
   const splittedCore = grunt.option('splitted-core');

   grunt.registerMultiTask('html-tmpl', 'Generate static html from .html.tmpl files', function() {
      logger.debug('Запускается задача html-tmpl.');
      const start = Date.now(),
         done = this.async(),
         root = this.data.root,
         application = this.data.application,
         applicationRoot = path.join(root, application),
         resourcesRoot = path.join(applicationRoot, 'resources'),
         filePattern = this.data.filePattern,
         componentsProperties = {}; //TODO

      convertTmpl(splittedCore, resourcesRoot, filePattern, componentsProperties, function(err) {
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

         /*
          Даннный флаг определяет надо ли заменить в статических страничках конструкции типа %{FOO_PATH}, на абсолютные пути.
          false - если у нас разделённое ядро и несколько сервисов.
          true - если у нас монолитное ядро или один сервис.
          */
         replacePath = !(grunt.option('splitted-core') && grunt.option('multi-service'));

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
      for (const pathModule of pathsModules) {
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
         const start = Date.now();
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
         globalParams: globalParams,
         urlServicePath: grunt.option('url-service-path') ? grunt.option('url-service-path') : application,
         wsPath: grunt.option('splitted-core') ? 'resources/WS.Core/' : 'ws/'
      };

      helpers.recurse(applicationRoot, function(file, callback) {
         if (helpers.validateFile(path.relative(applicationRoot, file), patterns)) {
            fs.readFile(file, (err, text) => {
               if (err) {
                  logger.error({
                     error: err
                  });
                  callback();
                  return;
               }
               let componentInfo = {};
               try {
                  componentInfo = parseJsComponent(text.toString());
               } catch (error) {
                  logger.error({
                     message: 'Возникла ошибка при парсинге файла',
                     filePath: file,
                     error: error
                  });
                  callback();
                  return;
               }

               generateStaticHtmlForJs(file, componentInfo, contents, config, modules, replacePath)
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
