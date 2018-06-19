/**
 * Плагин, который маркирует флагом cached все входящие файлы.
 * cached == true, если файл не менялся между запусками сборки.
 * @author Бегунов Ал. В.
 */

'use strict';

const logger = require('../../../lib/logger').logger(),
   through = require('through2');

/**
 * Объявление плагина
 * @param {ChangesStore|Cache} cache кеш сборки статики или сбора фраз локализации
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {*}
 */
module.exports = function declarePlugin(cache, moduleInfo = null) {
   return through.obj(async function onTransform(file, encoding, callback) {
      try {
         const isChanged = cache.isFileChanged(file.path, file.stat.mtime, moduleInfo);
         if (isChanged instanceof Promise) {
            file.cached = !(await isChanged);
         } else {
            file.cached = !isChanged;
         }
      } catch (error) {
         logger.error({ error });
      }
      callback(null, file);
   });
};
