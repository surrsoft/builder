'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../lib/logger').logger(),
   transliterate = require('../../lib/transliterate'),
   processingRoutes = require('../../lib/processing-routes');

module.exports = function(moduleInfo) {
   return through.obj(function(file, encoding, callback) {
      if (!file.path.endsWith('.routes.js')) {
         return callback(null, file);
      }

      try {
         const relativePath = path.join(moduleInfo.folderName, file.relative);
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
         //подготовим routes-info.json
         processingRoutes.prepareToSave(moduleInfo.routesInfo, Object.keys(moduleInfo.contents.jsModules));
         const routesInfoText = JSON.stringify(moduleInfo.routesInfo, null, 3);
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
