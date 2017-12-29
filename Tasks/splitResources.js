'use strict';

const
   fs = require('fs'),
   humanize = require('humanize'),
   path = require('path');


function isNeededValue(key, value) {
   let matchs = value.match(key);

   if (matchs && matchs[1]) {
      return true;
   } else {
      return false
   }
}

function getName(path, isResources, isRootApp, sep) {
   let splitPath;

   if (sep) {
      splitPath = path.split(sep);
   } else {
      splitPath = path.split('/');
   }

   if (splitPath.indexOf('ws') > -1) {
      return '';
   }

   if (isRootApp) {
      return splitPath[splitPath.length - 1];
   }

   if (isResources) {
      let index = splitPath.indexOf('resources');
      if (index == -1) {
         return '';
      }
      return splitPath[index + 1];
   }


   return splitPath[0];
}

module.exports = function splitResourcesTask(grunt) {
   let rootPath = path.join(grunt.option('root') || '', grunt.option('application') || '');

   function getPath(nameFile, nameModule, isResources) {
      let newPath;

      if (isResources) {
         newPath = path.join(rootPath, '/resources/' + nameFile);
      } else if (nameModule) {
         newPath = path.join(rootPath, '/resources/' + nameModule + '/' + nameFile);
      } else {
         newPath = path.join(rootPath, '/' + nameFile);
      }

      return path.normalize(newPath);
   }

   function writeFileInModules(data, name) {
      let pathModule;

      Object.keys(data).forEach(function(nameModule) {

         pathModule = getPath(name, nameModule);

         try {
            if (name != 'contents.js') {
               fs.writeFileSync(pathModule, JSON.stringify(data[nameModule], undefined, 2));
            } else {
               fs.writeFileSync(pathModule,"contents=" + JSON.stringify(data[nameModule]));
            }
         } catch(err) {
            grunt.fail.fatal(`Не смог записать файл: ${pathModule} \n ${err.stack}`);
         }
      });
   }

   function getOptionModule(data, splitData, option) {
      let
         result = splitData,
         nameModule;


      Object.keys(data[option]).forEach(function(key) {
         if (option && option == 'dictionary') {
            return;
         } else {
            if (option == 'jsModules') {
               nameModule = getName(data[option][key], false, false);
            } else {
               nameModule = getName(data[option][key], true);
            }

            if (!nameModule) {
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
         if (data.jsModules[nameModule]) {
            nameModule = getName(data.jsModules[nameModule], false, false);
         } else if(nameModule){
            nameModule = getName(nameModule, false, false);
         } else {
            throw new Error(`Не смог найти модуль: ${nameModule} для статической страницы ${key}`);
         }

         if (!nameModule) {
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
         fullRoutes = JSON.parse(fs.readFileSync(getPath('routes-info.json', undefined, true)));

      try {
         Object.keys(fullRoutes).forEach(function (routes) {
            nameModule = getName(routes, true, false, path.sep);

            if (!nameModule) {
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
            if(fullContents.buildnumber) {
               splitContents[nameModule].buildnumber = fullContents.buildnumber;
            }
         });

         splitContents = getOptionModule(fullContents, splitContents, 'jsModules');
         //Почему-то не работает, но я узнаю почему!!!Или нет(
         //splitContents = getOptionModule(fullContents, splitContents, 'requirejsPaths');
         if (fullContents.htmlNames) {
            splitContents = getOptionHtmlNames(fullContents, splitContents);
         }
      } catch(err) {
         grunt.fail.fatal("Ошибка при обработке contents.json.\n Имя модуля: " + nameModule + "\n" + err.stack);
      }

      return splitContents;
   }

   function splitModuleDependencies() {
      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается подзадача разбиения module-dependencies.json`);

      let
         existFile,
         nameModule,
         splitModuleDep = {},
         fullModuleDepCont = JSON.stringify(JSON.parse(fs.readFileSync(getPath('module-dependencies.json', undefined, true)))),
         fullModuleDep;

      //TODO Костыль для того что бы на сервисе-представлений модули из ws ссылались на WS.Core и WS.Deprecated
      let
         replaceStrDeprect,
         replaceStrCore;
      if (path.sep === '\\') {
         replaceStrDeprect = '"resources\\\\WS.Deprecated\\';
         replaceStrCore = '"resources\\\\WS.Core\\';
      } else {
         replaceStrDeprect = '"resources/WS.Deprecated/';
         replaceStrCore = '"resources/WS.Core/';
      }
      fullModuleDepCont = fullModuleDepCont.replace(/\"ws[\\|/]deprecated[\\|/]/g, replaceStrDeprect);
      fullModuleDepCont = fullModuleDepCont.replace(/\"ws[\\|/]/g, replaceStrCore);
      fullModuleDep = JSON.parse(fullModuleDepCont);

      try {
         Object.keys(fullModuleDep.nodes).forEach(function(node) {
            existFile = fs.existsSync(getPath(fullModuleDep.nodes[node].path));
            if (!existFile) {
               if (node.indexOf('/cdn/') === -1) {
                  grunt.log.warn(`Не нашёл данный модуль ${node},\n по указанному пути ${fullModuleDep.nodes[node].path}`);
               }
               return;
            }

            if (fullModuleDep.nodes[node].path) {
               nameModule = getName(fullModuleDep.nodes[node].path, true, false, path.sep);
            } else {
               grunt.log.warn(`Не нашёл путь до модуля:  ${node}`);
               return;
            }

            if (!nameModule) {
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
         preloadUrls = {},
         matchs,
         modulePreload,
         preload,
         allFiles,
         nameModules;

      try {
         Object.keys(modules).forEach(function(module) {
            nameModules = getName(modules[module], true, false);

            if (!nameModules) {
               return;
            }

            allFiles = fs.readdirSync(getPath(nameModules, undefined, true));
            allFiles.some(function(file) {
               if (file.indexOf('.s3mod') > -1) {
                  modulePreload =  fs.readFileSync(getPath(file, nameModules), {encoding: 'utf8'});
                  return true;
               }
            });

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
         grunt.fail.fatal("Ошибка при обработке preload_urls.json.\n Имя модуля: " + getPath(file, nameModules) + "\n" + err.stack );
      }

      return preloadUrls;
   }


   function slpitStaticHtml(modules) {
      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается подзадача распределения статически html страничек`);

      let
         nameModules,
         pathContents,
         contents;

      Object.keys(modules).forEach(function(module) {
         nameModules = getName(modules[module], true, false);

         if (!nameModules) {
            return;
         }

         try {
            pathContents = path.join(rootPath, '/resources/' + nameModules + '/contents.json');
            contents = JSON.parse(fs.readFileSync(pathContents, {encoding: 'utf8'}));
         } catch(err) {
            grunt.fail.fatal("Не смог найти фалй contents.json.\n Имя модуля: " + nameModules + "\n" + err.stack );
         }

         let
            listPathStaticHtml = {},
            staticHtml = Object.keys(contents.htmlNames),
            contentsHtml,
            nameHtml;

         if (staticHtml.length !== 0) {
            staticHtml.forEach(function(Html) {
               try {
                  nameHtml = getName(contents.htmlNames[Html], false, true);
                  contentsHtml = fs.readFileSync(getPath(nameHtml), {encoding: 'utf8'});
                  fs.writeFileSync(getPath(nameHtml, nameModules), contentsHtml);
                  listPathStaticHtml[nameHtml] = nameModules + "/" + nameHtml;
               } catch(err) {
                  grunt.fail.fatal("Не смог найти файл" + nameHtml + ".\n" + err.stack );
               }
            });
            fs.writeFileSync(getPath('static_templates.json', nameModules), JSON.stringify(listPathStaticHtml, undefined, 2));
         }

      });
   }

   grunt.registerMultiTask('splitResources', 'Разбивает мета данные по модулям', function () {

      let fullContents = JSON.parse(fs.readFileSync(getPath('contents.json', undefined, true)));

      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается задача разбиения мета данных.`);

      writeFileInModules(splitRoutes(), 'routes-info.json');
      grunt.log.ok(`${humanize.date('H:i:s')} : Подзадача разбиения routes-info.json успешно выполнена.`);

      let splitCont = splitContents(fullContents);
      writeFileInModules(splitCont, 'contents.json');
      writeFileInModules(splitCont, 'contents.js');
      grunt.log.ok(`${humanize.date('H:i:s')} : Подзадача разбиения contents.json успешно выполнена.`);

      writeFileInModules(splitModuleDependencies(), 'module-dependencies.json');
      grunt.log.ok(`${humanize.date('H:i:s')} : Подзадача разбиения module-dependencies.json успешно выполнена.`);

      if(fs.existsSync(getPath('preload_urls.json', undefined, true))) {
         writeFileInModules(splitPreloadUrls(fullContents.requirejsPaths), 'preload_urls.json');
         grunt.log.ok(`${humanize.date('H:i:s')} : Подзадача разбиения preload_urls.json успешно выполнена.`);
      }

      slpitStaticHtml(fullContents.requirejsPaths);
      grunt.log.ok(`${humanize.date('H:i:s')} : Подзадача распределения статически html страничек успешно выполнена.`);

      grunt.log.ok(`${humanize.date('H:i:s')} : Задача разбиения мета данных завершена успешно.`);
   });
};