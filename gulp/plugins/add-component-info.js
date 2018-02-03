'use strict';

const through = require('through2'),
   parseJsComponent = require('../../lib/parse-js-component'),
   logger = require('../../lib/logger').logger();

module.exports = function() {
   return through.obj(function(file, encoding, callback) {
      if (file.extname === '.js') {
         try {
            file.componentInfo = parseJsComponent(file.contents.toString());
         } catch (error) {
            logger.error({
               message: 'Ошибка при парсинге JS файла',
               filePath: file.history[0],
               error: error,
               moduleInfo: file.moduleInfo
            });
         }
      }
      this.push(file);
      callback();
   });
};
