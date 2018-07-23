/**
 * Плагин для локалицации xhtml.
 * В XML формате расставляются скобки {[]} - аналог rk - для локализцемых фраз (строки в разметке и переводимые опции).
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   execInPool = require('../../common/exec-in-pool');

/**
 * Объявление плагина
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {ChangesStore} changesStore кеш
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {Pool} pool пул воркеров
 * @returns {stream}
 */
module.exports = function declarePlugin(config, changesStore, moduleInfo, pool) {
   return through.obj(async function onTransform(file, encoding, callback) {
      try {
         if (file.cached) {
            callback(null, file);
            return;
         }
         if (file.extname !== '.xhtml') {
            callback(null, file);
            return;
         }
         const componentsPropertiesFilePath = path.join(config.cachePath, 'components-properties.json');
         const [error, newText] = await execInPool(pool, 'prepareXHTML', [
            file.contents.toString(),
            componentsPropertiesFilePath
         ]);
         if (error) {
            changesStore.markFileAsFailed(file.history[0]);
            logger.error({
               message: 'Ошибка при локализации XHTML',
               error,
               moduleInfo,
               filePath: file.path
            });
         } else {
            file.contents = Buffer.from(newText);
         }
      } catch (error) {
         changesStore.markFileAsFailed(file.history[0]);
         logger.error({
            message: "Ошибка builder'а при локализации XHTML",
            error,
            moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
