'use strict';

const path = require('path');
const fs = require('fs-extra');
const async = require('async');
const helpers = require('../lib/helpers');
const transliterate = require('../lib/transliterate');
const parseJsComponent = require('../lib/parse-js-component');
const humanize = require('humanize');
const logger = require('../lib/logger').logger();

const dblSlashes = /\\/g;
const isModuleJs = /\.module\.js$/;
const QUOTES = /"|'/g;

const
   contents = {},
   contentsModules = {},
   xmlContents = {},
   htmlNames = {},
   jsModules = {},
   requirejsPaths = {};

function removeLeadingSlash(filePath) {
   let newFilePath = filePath;
   if (newFilePath) {
      const head = newFilePath.charAt(0);
      if (head === '/' || head === '\\') {
         newFilePath = newFilePath.substr(1);
      }
   }
   return newFilePath;
}

module.exports = function(grunt) {
   grunt.registerMultiTask('convert', 'transliterate paths', async function() {
      grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача конвертации ресурсов`);
      const startTask = Date.now();
      const done = this.async(); //eslint-disable-line no-invalid-this
      const
         symlink = !!grunt.option('symlink'),
         modulesFilePath = (grunt.option('modules') || '').replace(QUOTES, ''),
         serviceMapping = (grunt.option('service_mapping') || '').replace(QUOTES, ''),
         i18n = !!grunt.option('index-dict'),
         application = grunt.option('application') || '',
         applicationName = application.replace('/', '').replace(dblSlashes, ''),
         applicationRoot = this.data.cwd, //eslint-disable-line no-invalid-this
         resourcesPath = path.join(applicationRoot, 'resources');

      let indexModule = 0;

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
      while (errorRemove && attemptRemove) { //eslint-disable-line no-await-in-loop
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

      //обработка модулей
      async.eachSeries(paths, function(input, callbackForProcessingModule) {
         const partsFilePath = input.replace(dblSlashes, '/').split('/');
         const moduleName = partsFilePath[partsFilePath.length - 1];
         const tsdModuleName = transliterate(moduleName);

         if (applicationName === tsdModuleName) {
            grunt.fail.fatal('Имя сервиса и имя модуля облака не должны совпадать. Сервис: ' + applicationName, '; Модуль: ' + tsdModuleName);
         }

         contentsModules[moduleName] = tsdModuleName;
         requirejsPaths[tsdModuleName] = removeLeadingSlash(path.join(application, 'resources', tsdModuleName).replace(dblSlashes, '/'));

         helpers.recurse(input, async function(file, callbackForProcessingFile) {
            try {
               const destination = path.join(resourcesPath, tsdModuleName,
                  transliterate(path.relative(input, file)));

               if (isModuleJs.test(file)) {
                  grunt.log.ok('Читаем js-модуль по пути: ' + file);
                  const text = await fs.readFile(file);

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

                  if (componentInfo.hasOwnProperty('componentName')) {
                     const partsComponentName = componentInfo.componentName.split('!');
                     if (partsComponentName[0] === 'js') {
                        jsModules[partsComponentName[1]] = path.join(tsdModuleName,
                           transliterate(path.relative(input, file))).replace(dblSlashes, '/');
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

         }, function() {
            logger.progress(helpers.percentage(++indexModule, paths.length), input);
            callbackForProcessingModule();
         });
      }, function(err) {
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

            requirejsPaths.WS = removeLeadingSlash(path.join(application, 'ws/').replace(dblSlashes, '/'));

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
      });

   });
};
