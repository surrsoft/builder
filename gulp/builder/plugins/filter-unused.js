/**
 * Плагин для фильтрации не нужных для стенда файлов. Например, less.
 * @author Бегунов Ал. В.
 */

'use strict';

const logger = require('../../../lib/logger').logger(),
   through = require('through2');

/**
 * Объявление плагина
 * @returns {*}
 */
module.exports = function declarePlugin() {
   return through.obj(function onTransform(file, encoding, callback) {
      try {
         // less не должны попадать в стенд или дистрибутив
         if (file.extname !== '.less') {
            callback(null, file);
            return;
         }
      } catch (error) {
         logger.error({ error });
      }
      callback();
   });
};
