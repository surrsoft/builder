'use strict';

const through = require('through2'),
   path = require('path'),
   parseJsComponent = require('../../lib/parse-js-component'),
   logger = require('../../lib/logger').logger(),
   transliterate = require('../../lib/transliterate');

module.exports = function() {
   return through.obj(function(file, encoding, callback) {
      if (file.extname === '.js') {
         try {
            file.componentInfo = parseJsComponent(file.contents.toString());
            if (file.path.endsWith('.module.js') && file.componentInfo.hasOwnProperty('moduleName')) {
               const relativePath = path.join(file.moduleInfo.folderName, file.relative);
               file.moduleInfo.contents.jsModules[file.componentInfo.moduleName] = transliterate(relativePath);
            }
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
