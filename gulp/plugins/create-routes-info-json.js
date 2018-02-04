'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../lib/logger').logger(),
   helpers = require('../../lib/helpers'),
   transliterate = require('../../lib/transliterate'),
   processingRoutes = require('../../lib/processing-routes');

module.exports = function(moduleInfo) {
   return through.obj(function(file, encoding, callback) {
      if (!file.path.endsWith('.routes.js')) {
         return callback(null, file);
      }

      try {
         const relativePath = path.join('resources', moduleInfo.folderName, file.relative);
         moduleInfo.routesInfo[transliterate(relativePath)] = processingRoutes.parseRoutes(file.contents.toString());
      } catch (error) {
         logger.error({
            message: 'Ошибка при обработке файла роутинга',
            filePath: file.history[0],
            error: error,
            moduleInfo: moduleInfo
         });
      }
      callback(null, file);
   }, function(callback) {
      try {
         //если нет данных, то не нужно и сохранять
         if (!Object.getOwnPropertyNames(moduleInfo.routesInfo).length) {
            return callback();
         }

         //подготовим routes-info.json
         processingRoutes.prepareToSave(moduleInfo.routesInfo, Object.keys(moduleInfo.contents.jsModules));

         const routesInfoText = JSON.stringify(helpers.sortObject(moduleInfo.routesInfo), null, 2);
         const routesInfoFile = new Vinyl({
            path: 'routes-info.json',
            contents: new Buffer(routesInfoText),
            moduleInfo: moduleInfo
         });
         this.push(routesInfoFile);

      } catch (error) {
         logger.error({
            message: 'Ошибка Builder\'а',
            error: error,
            moduleInfo: moduleInfo
         });
      }
      callback();
   });
};
