'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../lib/logger').logger(),
   transliterate = require('../../lib/transliterate'),
   processingRoutes = require('../../lib/processing-routes');

module.exports = function() {
   return through.obj(function(file, encoding, callback) {
      if (!file.path.endsWith('.routes.js')) {
         return callback(null, file);
      }

      try {
         const relativePath = path.join(file.moduleInfo.folderName, file.relative);
         file.moduleInfo.routesInfo[transliterate(relativePath)] = processingRoutes.parseRoutes(file.contents.toString());
      } catch (error) {
         logger.error({
            message: 'Ошибка при обработке файла роутинга',
            filePath: file.history[0],
            error: error,
            moduleInfo: file.moduleInfo
         });
      }
      callback(null, file);
   });
};
