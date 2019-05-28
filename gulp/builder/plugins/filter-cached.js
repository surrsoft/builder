/**
 * Плагин для фильтрации не изменённых файлов, чтобы не перезаписывать и не напрягать диск.
 * @author Бегунов Ал. В.
 */

'use strict';

const logger = require('../../../lib/logger').logger(),
   through = require('through2');

/**
 * Объявление плагина
 * @returns {stream}
 */
module.exports = function declarePlugin(moduleInfo) {
   return through.obj(function onTransform(file, encoding, callback) {
      try {
         if (moduleInfo.rebuild || !file.hasOwnProperty('cached') || !file.cached) {
            callback(null, file);
            return;
         }
      } catch (error) {
         logger.error({ error });
      }
      callback();
   });
};
