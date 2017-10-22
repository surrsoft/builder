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

const regExpRouting = new RegExp("(?:resources" + pathSep + ")([\\w\\-\\.]*)(?:" + pathSep + ")|(ws)(?:" + pathSep +")");

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
      contentsJsPath = path.join(rootPath, '/resources/contents.js'),
      contentsJsonPath = path.join(rootPath, '/resources/contents.json');


   function writeFileInModules(data, name) {

      let pathModule;

      Object.keys(data).forEach(function(nameModule) {

         if (nameModule != 'ws') {
            pathModule = path.join(rootPath, '/resources/' + nameModule + '/' + name);
         } else {
            pathModule = path.join(rootPath, nameModule + '/' + name);
         }
         pathModule = path.normalize(pathModule);

         try {
            if (name != 'contents.js') {
               fs.writeFileSync(pathModule, JSON.stringify(data[nameModule], undefined, 2));
            } else {
               fs.writeFileSync(pathModule,"contents=" + JSON.stringify(data[nameModule]));
            }
         } catch(err) {
            grunt.fail.fatal(`Не смог записать файл: ${pathModule}`);
         }
      })
   }

   function splitRoutes() {
      let
         nameModule,
         splitRoutes = {},
         fullRoutes = JSON.parse(fs.readFileSync(routesPath));

         Object.keys(fullRoutes).forEach(function (routes) {
            nameModule = getNameModule(routes);

            if (nameModule == null) {
               grunt.fail.fatal(`Не смог разобрать корректно путь роутинга ${routes}`);
            }

            if (!splitRoutes[nameModule]) {
               splitRoutes[nameModule] = {};
            }

            splitRoutes[nameModule][routes] = fullRoutes[routes];
         });

      return splitRoutes;
   }

   function getOptionModule(data, splitData, option) {
      let
         regExp = /(?:resources\/)?([\w\-\.\)\(]*)([\.|\s|\/]*)/,
         result = splitData,
         nameModule

      Object.keys(data[option]).forEach(function(key) {
         if (option && option == 'dictionary') {
            return;
         } else {
            nameModule = data[option][key].match(regExp)[1];
         }

         try {
            result[nameModule][option][key] = data[option][key];
         } catch(err) {
            grunt.fail.fatal(`Жопа Ж ${data[option][key]}`)
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
         result[nameModule].htmlNames[key] = data.htmlNames[key];
      });

      return result;
   }

   function getOptionDictionary(data, name) {
      let
         regExp = new RegExp("(" + name + ")(\\.)"),
         result = {};

      Object.keys(data).forEach(function(dist) {
         if(isNeededValue(regExp ,dist)) {
            result[dist] = data[dist];
         }
      });

      return result;
   }

   function splitContents() {
      let
         nameModule,
         splitContents = {},
         fullContents = JSON.parse(fs.readFileSync(contentsJsonPath));

      //TODO колстыль чтобы при разборе requirejsPaths не валилась сборка так как ws не модуль
      fullContents.modules.ws = "ws";

      Object.keys(fullContents.modules).forEach(function(module) {
         nameModule = fullContents.modules[module];
         splitContents[nameModule] = {
            htmlNames: {},
            jsModules: {},
            modules: {},
            requirejsPaths: {},
            services: fullContents.services,
            xmlContents: fullContents.xmlContents,
            availableLanguage: fullContents.availableLanguage,
            defaultLanguage: fullContents.defaultLanguage,
            dictionary: {}

         }

         splitContents[nameModule].modules[module] = nameModule;
         splitContents[nameModule].dictionary = getOptionDictionary(fullContents.dictionary, nameModule);
      });

      splitContents = getOptionModule(fullContents, splitContents, 'jsModules');
      splitContents = getOptionModule(fullContents, splitContents, 'requirejsPaths');
      splitContents = getOptionHtmlNames(fullContents, splitContents);

      return splitContents;
   }

   grunt.registerMultiTask('splitResources', 'Разбивает мета данные по модулям', function () {

      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается задача разбиения мета данных.`);

      writeFileInModules(splitRoutes(), 'routes-info.json');

      let splitCont = splitContents();
      writeFileInModules(splitCont, 'contents.json');
      writeFileInModules(splitCont, 'contents.js');



      grunt.log.ok(`${humanize.date('H:i:s')} : Задача разбиения мета данных завершена.`);

   });
};