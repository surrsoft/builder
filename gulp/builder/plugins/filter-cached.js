/**
 * Плагин для фильтрации не изменённых файлов, чтобы не перезаписывать и не напрягать диск.
 * Фильтруем less тут же. Он не нужен в дистрибутиве.
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
            if (!file.hasOwnProperty('cached') || !file.cached) {
               callback(null, file);
               return;
            }
         }
      } catch (error) {
         logger.error({ error });
      }
      callback();
   });
};
