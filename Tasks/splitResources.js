'use strict';

const
   fs = require('fs'),
   humanize = require('humanize'),
   path = require('path');
var
   pathSep;

if (path.sep == '/') {
   pathSep = '\\/';
} else {
   pathSep = '\\\\';
}

const regExpRouting = new RegExp("(?:resources" + pathSep + ")([\\w\\-\\.\\)\\(]*)(?:\\s*|" + pathSep + ")|(ws)(?:\\s*|" + pathSep +")");

function getNameModule(path) {
   let match = path.match(regExpRouting);

   if (!match) {
      return  null;
   }

   if (match[1]) {
      return match[1];
   } else if (match[2]) {
      return match[2];
   } else {
      return null;
   }
}

function isNeededValue(key, value) {
   let matchs = value.match(key);

   if (matchs && matchs[1]) {
      return true;
   } else {
      return false
   }
}


module.exports = function splitResourcesTask(grunt) {
   let
      root = grunt.option('root') || '',
      app = grunt.option('application') || '',
      rootPath = path.join(root, app),
      moduleDepPath = path.join(rootPath, '/resources/module-dependencies.json'),
      routesPath = path.join(rootPath, '/resources/routes-info.json'),
      preloadUrlsPath = path.join(rootPath, '/resources/preload_urls.json'),
      contentsJsonPath = path.join(rootPath, '/resources/contents.json');


   function writeFileInModules(data, name) {

      let pathModule;

      Object.keys(data).forEach(function(nameModule) {

         pathModule = path.normalize(path.join(rootPath, '/resources/' + nameModule + '/' + name));

         try {
            if (name != 'contents.js') {
               fs.writeFileSync(pathModule, JSON.stringify(data[nameModule], undefined, 2));
            } else {
               fs.writeFileSync(pathModule,"contents=" + JSON.stringify(data[nameModule]));
            }
         } catch(err) {
            grunt.fail.fatal(`Не смог записать файл: ${pathModule}`);
         }
      });
   }

   function getOptionModule(data, splitData, option) {
      let
         regExp,
         result = splitData,
         nameModule;

      if (option == 'jsModules') {
         regExp = /(?:resources\/)?([\w\-\.\)\(]*)([\.|\s|\/]*)/;
      } else {
         regExp = /^(?:.*)+?(?:resources\/|ws\/)(.*)$/;
      }

      Object.keys(data[option]).forEach(function(key) {
         if (option && option == 'dictionary') {
            return;
         } else {
            nameModule = data[option][key].match(regExp)[1];
            if (nameModule === '') {
               return;
            }
         }

         try {
            result[nameModule][option][key] = data[option][key];
         } catch(err) {
            grunt.fail.fatal(`Не смог корректно разобрать опцию из contents.json. Опция:${option} Модуль: ${data[option][key]}`)
         }
      });

      return result;
   }

   function getOptionHtmlNames(data, splitData) {
      let
         result = splitData,
         nameModule;

      Object.keys(data.htmlNames).forEach(function(key) {
         nameModule = key.replace('js!', '');
         nameModule = data.jsModules[nameModule].match(/[\w\-\.]*/)[0];
         if (nameModule == 'ws') {
            return;
         }
         result[nameModule].htmlNames[key] = data.htmlNames[key];
      });

      return result;
   }

   function getOptionDictionary(data, name) {
      let
         regExp = new RegExp("(" + name + ")(\\.)"),
         result = {};

      if (name == 'ws') {
         return;
      }

      Object.keys(data).forEach(function(dist) {
         if(isNeededValue(regExp ,dist)) {
            result[dist] = data[dist];
         }
      });

      return result;
   }

   function splitRoutes() {
      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается подзадача разбиения routes-info.json`);

      let
         nameModule,
         splitRoutes = {},
         fullRoutes = JSON.parse(fs.readFileSync(routesPath));

      try {
         Object.keys(fullRoutes).forEach(function (routes) {
            nameModule = getNameModule(routes);

            if (!nameModule) {
               grunt.fail.fatal(`Не смог разобрать корректно путь роутинга ${routes}`);
            }

            if (nameModule == 'ws') {
               return;
            }

            if (!splitRoutes[nameModule]) {
               splitRoutes[nameModule] = {};
            }

            splitRoutes[nameModule][routes] = fullRoutes[routes];
         });
      } catch(err) {
         grunt.fail.fatal("Ошибка при обработке routes-info.json.\n Имя модуля: " + nameModule + "\n" + err.stack );
      }

      return splitRoutes;
   }

   function splitContents(fullContents) {
      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается подзадача разбиения contents.json`);

      let
         nameModule,
         splitContents = {};

      try {
         Object.keys(fullContents.modules).forEach(function(module) {
            nameModule = fullContents.modules[module];

            if (nameModule === 'ws/') {
               return;
            }

            splitContents[nameModule] = {
               htmlNames: {},
               jsModules: {},
               modules: {},
               requirejsPaths: {},
               services: fullContents.services,
               xmlContents: fullContents.xmlContents,
            }

            splitContents[nameModule].modules[module] = nameModule;
            if (fullContents.dictionary) {
               splitContents[nameModule].availableLanguage = fullContents.availableLanguage;
               splitContents[nameModule].defaultLanguage = fullContents.defaultLanguage;
               splitContents[nameModule].dictionary = getOptionDictionary(fullContents.dictionary, nameModule);
            }
         });

         splitContents = getOptionModule(fullContents, splitContents, 'jsModules');
         //Почему-то не работает, но я узнаю почему!!!
         //splitContents = getOptionModule(fullContents, splitContents, 'requirejsPaths');
         splitContents = getOptionHtmlNames(fullContents, splitContents);
      } catch(err) {
         grunt.fail.fatal("Ошибка при обработке contents.json.\n Имя модуля: " + nameModule + "\n" + err.stack );
      }

      return splitContents;
   }

   function splitModuleDependencies() {
      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается подзадача разбиения module-dependencies.json`);

      let
         nameModule,
         splitModuleDep = {},
         fullModuleDep = JSON.parse(fs.readFileSync(moduleDepPath));

      try {
         Object.keys(fullModuleDep.nodes).forEach(function(node) {
            if (fullModuleDep.nodes[node].path) {
               nameModule = getNameModule(fullModuleDep.nodes[node].path);
            } else {
               grunt.log.warn(`Не нашёл путь до модуля:  ${node}`);
               return;
            }

            if (!nameModule || nameModule == 'ws') {
               return;
            }

            if (!splitModuleDep[nameModule]) {
               splitModuleDep[nameModule] = {
                  nodes:{},
                  links:{}
               }
            }

            splitModuleDep[nameModule].nodes[node] = fullModuleDep.nodes[node];
            splitModuleDep[nameModule].links[node] = fullModuleDep.links[node];

         });
      } catch (err) {
         grunt.fail.fatal("Ошибка при обработке module-dependencies.json.\n Имя модуля: " + nameModule + "\n" + err.stack );
      }
      return splitModuleDep;
   }

   function splitPreloadUrls(modules) {
      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается подзадача разбиения preload_urls.json`);

      let
         regExp = /(?:[\s\S]\/)(?:resources\/)?([\w\-\.\)\(]*)([\.|\s|\/]*)/,
         preloadUrls = {},
         pathsmod,
         matchs,
         modulePreload,
         preload,
         nameModules;

      try {
         Object.keys(modules).forEach(function(module) {
            nameModules = modules[module];
            nameModules = nameModules.match(regExp)[1];

            if (!nameModules || nameModules == 'ws') {
               return;
            }

            let allFiles = fs.readdirSync(path.join(rootPath, '/resources/' + nameModules));
            allFiles.some(function(file) {
               if (file.indexOf('.s3mod') > -1) {
                  pathsmod = path.join(rootPath, '/resources/' + nameModules + '/' + file)
                  return true;
               }
            });

            modulePreload = fs.readFileSync(pathsmod, {encoding: 'utf8'});

            matchs = modulePreload.match(/(<preload>)([\s\S]*)(<\/preload>)/);

            if(matchs) {
               matchs = matchs[2];
            } else {
               return;
            }

            preload = matchs.match(/[\"|\'][\w\?\=\.\#\/\-\&А-я]*[\"|\']/g);
            preloadUrls[nameModules] = [];

            preload.forEach(function(value) {
               preloadUrls[nameModules].push(value.replace(/['|"]/g, ''));
            });

         });
      } catch(err) {
         grunt.fail.fatal("Ошибка при обработке preload_urls.json.\n Имя модуля: " + pathsmod + "\n" + err.stack );
      }

      return preloadUrls;
   }

   grunt.registerMultiTask('splitResources', 'Разбивает мета данные по модулям', function () {

      let fullContents = JSON.parse(fs.readFileSync(contentsJsonPath));

      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается задача разбиения мета данных.`);

      writeFileInModules(splitRoutes(), 'routes-info.json');
      grunt.log.ok(`${humanize.date('H:i:s')} : Подзадача разбиения routes-info.json успешно выполнена`);

      let splitCont = splitContents(fullContents);
      writeFileInModules(splitCont, 'contents.json');
      writeFileInModules(splitCont, 'contents.js');
      grunt.log.ok(`${humanize.date('H:i:s')} : Подзадача разбиения contents.json успешно выполнена`);

      writeFileInModules(splitModuleDependencies(), 'module-dependencies.json');
      grunt.log.ok(`${humanize.date('H:i:s')} : Подзадача разбиения module-dependencies.json успешно выполнена`);

      try {
         fs.readFileSync(preloadUrlsPath)
         writeFileInModules(splitPreloadUrls(fullContents.requirejsPaths), 'preload_urls.json');
         grunt.log.ok(`${humanize.date('H:i:s')} : Подзадача разбиения preload_urls.json успешно выполнена`);
      } catch(err) {

      }

      grunt.log.ok(`${humanize.date('H:i:s')} : Задача разбиения мета данных завершена.`);
   });
};