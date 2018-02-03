'use strict';

const through = require('through2'),
   path = require('path'),
   parseJsComponent = require('../../lib/parse-js-component'),
   logger = require('../../lib/logger').logger(),
   transliterate = require('../../lib/transliterate');

module.exports = function() {
   return through.obj(function(file, encoding, callback) {
      if (!file.path.endsWith('.routes.js') {
         return callback(null, file);
      }

      try {
 
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
