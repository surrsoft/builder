'use strict';
const
   fs = require('fs'),
   humanize = require('humanize'),
   path = require('path');
var
   pathSep;

if (path.sep == '/') {
   pathSep = '/';
} else {
   pathSep = '\\\\';
}

const regExp = new RegExp("(?:resources" + pathSep + ")([\\w-.]*)(?:" + pathSep + ")|(ws)(?:" + pathSep +")");

function getNameModule(path) {
   let match = path.match(regExp);

   if (match[1]) {
      return match[1]
   } else if (match[2]) {
      return match[2]
   } else {
      return null;
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
            fs.writeFileSync(pathModule, JSON.stringify(data[nameModule], undefined, 2));
         } catch(err) {
            grunt.fail.fatal(`Не смог записать файл: ${pathModule}`);
         }
      })
   }

   function splitRoutes() {
      let
         nameModule,
         splitRoutes= {},
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

   grunt.registerMultiTask('splitResources', 'Разбивает мета данные по модулям', function () {

      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается задача разбиения мета данных.`);

      writeFileInModules(splitRoutes(), 'routes-info.json');





      grunt.log.ok(`${humanize.date('H:i:s')} : Задача разбиения мета данных завершена.`);

   });
};