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

let
   contents = {},
   contentsModules = {},
   xmlContents = {},
   htmlNames = {},
   jsModules = {},
   requirejsPaths = {};

function removeLeadingSlash(path) {
   if (path) {
      const head = path.charAt(0);
      if (head === '/' || head === '\\') {
         path = path.substr(1);
      }
   }
   return path;
}

module.exports = function(grunt) {
   grunt.registerMultiTask('convert', 'transliterate paths', function() {
      grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача конвертации ресурсов`);
      const start = Date.now();
      const done = this.async();
      const
         symlink = !!grunt.option('symlink'),
         modules = (grunt.option('modules') || '').replace(QUOTES, ''),
         serviceMapping = (grunt.option('service_mapping') || '').replace(QUOTES, ''),
         i18n = !!grunt.option('index-dict'),
         dryRun = grunt.option('dry-run'),
         application = grunt.option('application') || '',
         applicationName = application.replace('/', '').replace(dblSlashes, ''),
         applicationRoot = this.data.cwd,
         resourcesPath = path.join(applicationRoot, 'resources');

      let i = 0;
      let paths = modules.split(';');

      //сохраняем файл modules.json вручную, поскольку он временный
      grunt.file.write(path.join(resourcesPath, 'modules.json'), JSON.stringify(paths, null, 3));
      if (paths.length === 1 && grunt.file.isFile(paths[0])) {
         let input = paths[0];
         try {
            paths = grunt.file.readJSON(input);
            if (!Array.isArray(paths)) {
               grunt.log.error('Parameter "modules" incorrect');
               return;
            }
         } catch (e) {
            grunt.log.error(`Parameter "modules" incorrect. Can\'t read ${input}`);
            return;
         }
      }

      function copyFile(target, dest, data, cb) {
         let ext = path.extname(target);
         if (!symlink || (i18n && (ext === '.xhtml' || ext === '.html'))) {
            helpers.copyFile(target, dest, data, cb);
         } else {
            helpers.mkSymlink(target, dest, cb);
         }
      }

      function remove(dir) {
         let attempt = 1;
         let start = Date.now();

         (function _remove() {
            try {
               grunt.log.ok(`${humanize.date('H:i:s')}: Запускается удаление ресурсов(${attempt})`);
               fs.removeSync(dir);
               grunt.log.ok(`${humanize.date('H:i:s')}: Удаление ресурсов завершено(${(Date.now() - start) / 1000} sec)`);
               main();
            } catch (err) {
               if (++attempt <= 3) {
                  setTimeout(_remove, 1000);
               } else {
                  grunt.fail.fatal(err);
               }
            }
         })();
      }

      if (!dryRun) {
         remove(resourcesPath);
      } else {
         main();
      }

      function main() {
         async.eachSeries(paths, function(input, callback) {
            let parts = input.replace(dblSlashes, '/').split('/');
            let moduleName = parts[parts.length - 1];
            let tsdModuleName = transliterate(moduleName);

            if (applicationName === tsdModuleName) {
               grunt.fail.fatal('Имя сервиса и имя модуля облака не должны совпадать. Сервис: ' + applicationName, '; Модуль: ' + tsdModuleName);
            }

            contentsModules[moduleName] = tsdModuleName;
            requirejsPaths[tsdModuleName] = removeLeadingSlash(path.join(application, 'resources', tsdModuleName).replace(dblSlashes, '/'));

            helpers.recurse(input, function(file, callback) {
               let dest = path.join(resourcesPath, tsdModuleName,
                  transliterate(path.relative(input, file)));

               if (isModuleJs.test(file)) {
                  grunt.log.ok('Читаем js-модуль по пути: ' + file);
                  fs.readFile(file, function(err, text) {
                     if (err) {
                        logger.error({
                           message: 'Возникла ошибка при чтении файла',
                           filePath: file,
                           error: err
                        });
                        callback(err);
                     } else {
                        try {
                           const componentInfo = parseJsComponent(text.toString());
                           if (componentInfo.hasOwnProperty('componentName')) {
                              const parts = componentInfo.componentName.split('!');
                              if (parts[0] === 'js') {
                                 jsModules[parts[1]] = path.join(tsdModuleName,
                                    transliterate(path.relative(input, file))).replace(dblSlashes, '/');
                              }
                           }

                           if (!dryRun) {
                              copyFile(file, dest, text, callback);
                           } else {
                              callback();
                           }
                        }
                        catch (e) {
                           logger.error({
                              message: 'Возникла ошибка при парсинге файла',
                              filePath: file,
                              error: e
                           });
                           callback(e);
                        }
                     }
                  });
               } else if (!dryRun) {
                  copyFile(file, dest, null, callback);
               } else {
                  callback();
               }
            }, function() {
               grunt.log.ok(`[${helpers.percentage(++i, paths.length)}%] ${input}`);
               callback();
            });
         }, function(err) {
            if (err) {
               return grunt.fail.fatal(err);
            }

            try {
               contents.modules = contentsModules;
               contents.xmlContents = xmlContents;
               contents.jsModules = jsModules;
               contents.htmlNames = htmlNames;

               requirejsPaths.WS = removeLeadingSlash(path.join(application, 'ws/').replace(dblSlashes, '/'));

               contents.requirejsPaths = requirejsPaths;

               if (serviceMapping) {
                  let srvArr = serviceMapping.trim().split(' ');
                  if (srvArr.length % 2 === 0) {
                     let services = {};
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
            } catch (error) {

               grunt.fail.fatal(err);
            }

            logger.info(`Duration: ${(Date.now() - start) / 1000} sec`);
            done();
         });
      }
   });
};
