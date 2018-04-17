'use strict';

const path = require('path');
const fs = require('fs-extra');
const async = require('async');
const helpers = require('../lib/helpers');
const transliterate = require('../lib/transliterate');
const buildLess = require('../lib/build-less');
const parseJsComponent = require('../lib/parse-js-component');
const humanize = require('humanize');
const logger = require('../lib/logger').logger();

const dblSlashes = /\\/g;
const isModuleJs = /\.module\.js$/;
const isJs = /\.js$/;
const QUOTES = /"|'/g;
const NAME_NAVIGATION = /(optional\!)?(js\!SBIS3\.NavigationController|Navigation\/NavigationController)$/;

const contents = {},
   contentsModules = {},
   xmlContents = {},
   htmlNames = {},
   jsModules = {},
   requirejsPaths = {};

async function compileLess(lessFilePath, modulePath, sbis3ControlsPath, resourcePath, appRoot) {
   try {
      const moduleName = path.basename(modulePath);
      const cssFilePath = lessFilePath.replace('.less', '.css');
      if (await fs.pathExists(cssFilePath)) {
         //если файл уже есть, то не нужно его перезаписывать.
         //иначе при деплое локального стенда мы перезапишем css в исходниках.
         //просто ругаемся и ждём, что поправят.
         const message =
            `Существующий CSS-файл мешает записи результата компиляции '${lessFilePath}'. ` +
            'Необходимо удалить лишний CSS-файл';

         logger.warning({
            message: message,
            filePath: cssFilePath
         });
         return;
      }

      const data = await fs.readFile(lessFilePath);
      const result = await buildLess(lessFilePath, data.toString(), modulePath, sbis3ControlsPath, appRoot);
      if (result.ignoreMessage) {
         logger.debug(result.ignoreMessage);
      } else {
         const relativeLessFilePath = path.relative(modulePath, lessFilePath);
         const relativeResultCssFilePath = transliterate(
            path.join(moduleName, relativeLessFilePath.replace('.less', '.css'))
         );
         const resultCssPath = path.join(resourcePath, relativeResultCssFilePath);
         await fs.ensureDir(path.dirname(resultCssPath));
         await fs.writeFile(resultCssPath, result.text, { flag: 'w' });
         logger.debug(`file ${resultCssPath} successfully compiled`);
      }
   } catch (error) {
      logger.warning({
         message: 'Ошибка при компиляции less файла',
         error: error,
         filePath: lessFilePath
      });
   }
}

module.exports = function(grunt) {
   grunt.registerMultiTask('convert', 'transliterate paths', async function() {
      grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача конвертации ресурсов`);
      const startTask = Date.now();
      const doneAsync = this.async(); //eslint-disable-line no-invalid-this
      const done = () => {
         logger.correctExitCode();
         doneAsync();
      };
      const splittedCore = grunt.option('splitted-core'),
         symlink = !!grunt.option('symlink'),
         modulesFilePath = (grunt.option('modules') || '').replace(QUOTES, ''),
         serviceMapping = (grunt.option('service_mapping') || '').replace(QUOTES, ''),
         i18n = !!grunt.option('index-dict'),
         application = grunt.option('application') || '',
         applicationName = application.replace('/', '').replace(dblSlashes, ''),
         applicationRoot = this.data.cwd, //eslint-disable-line no-invalid-this
         resourcesPath = path.join(applicationRoot, 'resources'),
         packaging = grunt.option('package');

      let indexModule = 0;
      let fullListNavMod = [];

      let paths = [];
      try {
         paths = await fs.readJSON(modulesFilePath);
         if (!Array.isArray(paths)) {
            logger.error({
               message: 'Parameter "modules" incorrect',
               filePath: modulesFilePath
            });
            done();
            return;
         }
      } catch (e) {
         logger.error({
            message: 'Parameter "modules" incorrect. Can\'t read file',
            error: e,
            filePath: modulesFilePath
         });
         done();
         return;
      }

      function copyFile(target, destination, data, cb) {
         const ext = path.extname(target);
         if (!symlink || i18n && (ext === '.xhtml' || ext === '.html')) {
            helpers.copyFile(target, destination, data, cb);
         } else {
            helpers.mkSymlink(target, destination, cb);
         }
      }

      //пробуем удалить результат предудущей конвертации, если не получается, то ждём 1 секунду и снова пытаемся
      grunt.log.ok(`${humanize.date('H:i:s')}: Запускается удаление ресурсов`);
      let errorRemove = await helpers.tryRemoveFolder(resourcesPath);
      let attemptRemove = 5;
      while (errorRemove && attemptRemove) {
         //eslint-disable-line no-await-in-loop
         await helpers.delay(1000);
         grunt.log.ok(`${humanize.date('H:i:s')}: Удаление завершилось с ошибкой, пробуем ещё раз`);
         errorRemove = await helpers.tryRemoveFolder(resourcesPath);
         attemptRemove--;
      }
      if (errorRemove) {
         logger.error({
            message: 'Не удалось очистить директорию',
            error: errorRemove,
            filePath: resourcesPath
         });
         done();
         return;
      }
      grunt.log.ok(`${humanize.date('H:i:s')}: Удаление ресурсов завершено`);

      let sbis3ControlsPath = '';
      for (const modulePath of paths) {
         if (path.basename(modulePath) === 'SBIS3.CONTROLS') {
            sbis3ControlsPath = modulePath;
            logger.debug('Путь до модуля SBIS3.CONTROLS: ' + sbis3ControlsPath);
         }
      }

      //обработка модулей
      async.eachSeries(
         paths,
         function(input, callbackForProcessingModule) {
            const partsFilePath = input.replace(dblSlashes, '/').split('/');
            const moduleName = partsFilePath[partsFilePath.length - 1];
            const tsdModuleName = transliterate(moduleName);
            const listNavMod = [];

            if (applicationName === tsdModuleName) {
               grunt.fail.fatal(
                  'Имя сервиса и имя модуля облака не должны совпадать. Сервис: ' + applicationName,
                  '; Модуль: ' + tsdModuleName
               );
            }

            contentsModules[moduleName] = tsdModuleName;
            requirejsPaths[tsdModuleName] = helpers.removeLeadingSlash(
               path.join(application, 'resources', tsdModuleName).replace(dblSlashes, '/')
            );

            helpers.recurse(
               input,
               async function(file, callbackForProcessingFile) {
                  try {
                     const destination = path.join(
                        resourcesPath,
                        tsdModuleName,
                        transliterate(path.relative(input, file))
                     );

                     let text = '',
                        isNavigationModule = false;

                     if (isJs.test(file)) {
                        grunt.log.ok('Читаем js-файл по пути: ' + file);
                        text = await fs.readFile(file);
                        isNavigationModule = text.includes('Navigation/NavigationController');
                     }

                     if (file.endsWith('.less')) {
                        await compileLess(file, input, sbis3ControlsPath, resourcesPath, application);
                     }
                     if (isModuleJs.test(file) || isNavigationModule) {
                        let componentInfo = {};
                        try {
                           componentInfo = parseJsComponent(text.toString());
                        } catch (e) {
                           logger.error({
                              message: 'Возникла ошибка при парсинге файла',
                              filePath: file,
                              error: e
                           });
                        }

                        if (componentInfo.hasOwnProperty('componentName') && !isNavigationModule) {
                           const partsComponentName = componentInfo.componentName.split('!');
                           if (partsComponentName[0] === 'js') {
                              jsModules[partsComponentName[1]] = path
                                 .join(tsdModuleName, transliterate(path.relative(input, file)))
                                 .replace(dblSlashes, '/');
                           }
                        }
                        if (componentInfo.hasOwnProperty('componentDep') && componentInfo.componentName) {
                           const isNavigation = componentInfo.componentDep.some(function(name) {
                              return NAME_NAVIGATION.test(name);
                           });
                           if (isNavigation) {
                              listNavMod.push(componentInfo.componentName);
                           }
                        }
                        copyFile(file, destination, text, callbackForProcessingFile);
                     } else {
                        copyFile(file, destination, null, callbackForProcessingFile);
                     }
                  } catch (error) {
                     logger.error({
                        error: error
                     });
                     callbackForProcessingFile();
                  }
               },
               function() {
                  if (listNavMod.length !== 0) {
                     if (splittedCore) {
                        const output = path.join(path.join(resourcesPath, tsdModuleName), 'navigation-modules.json');
                        grunt.file.write(output, JSON.stringify(listNavMod.sort(), null, 2));
                     } else {
                        fullListNavMod = fullListNavMod.concat(listNavMod);
                     }
                  }
                  logger.progress(helpers.percentage(++indexModule, paths.length), input);
                  callbackForProcessingModule();
               }
            );
         },
         function(err) {
            try {
               if (err) {
                  logger.error({
                     error: err
                  });
                  grunt.fail.fatal(err);
                  return;
               }

               contents.modules = contentsModules;
               contents.xmlContents = xmlContents;
               contents.jsModules = jsModules;
               contents.htmlNames = htmlNames;

               requirejsPaths.WS = helpers.removeLeadingSlash(path.join(application, 'ws/').replace(dblSlashes, '/'));

               contents.requirejsPaths = requirejsPaths;

               if (serviceMapping) {
                  const srvArr = serviceMapping.trim().split(' ');
                  if (srvArr.length % 2 === 0) {
                     const services = {};
                     for (let i = 0; i < srvArr.length; i += 2) {
                        services[srvArr[i]] = srvArr[i + 1];
                     }
                     contents.services = services;
                  } else {
                     grunt.fail.fatal('Services list must be even!');
                  }
               }

               if (fullListNavMod.length !== 0 && !splittedCore) {
                  grunt.file.write(
                     path.join(resourcesPath, 'navigation-modules.json'),
                     JSON.stringify(fullListNavMod.sort(), null, 2)
                  );
               }

               contents.buildMode = packaging ? 'release' : 'debug';
               const sorted = helpers.sortObject(contents);
               grunt.file.write(path.join(resourcesPath, 'contents.json'), JSON.stringify(sorted, null, 2));
               grunt.file.write(path.join(resourcesPath, 'contents.js'), 'contents=' + JSON.stringify(sorted));
               logger.info(`Duration: ${(Date.now() - startTask) / 1000} sec`);
            } catch (error) {
               logger.error({
                  error: error
               });
            }
            done();
         }
      );
   });
};
