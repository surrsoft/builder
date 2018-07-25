/**
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   execInPool = require('../../common/exec-in-pool');

const supportExtensions = ['.js', '.xhtml', '.tmpl'];

/**
 * Объявление плагина
 * @param {GrabberConfiguration} config конфигурация сбора фраз локализации
 * @param {Cache} cache кеш
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {Pool} pool пул воркеров
 * @returns {stream}
 */
module.exports = function declarePlugin(config, cache, moduleInfo, pool) {
   return through.obj(async(file, encoding, callback) => {
      try {
         if (!supportExtensions.includes(file.extname)) {
            callback();
            return;
         }

         if (file.cached) {
            callback();
            return;
         }

         const componentsPropertiesFilePath = path.join(config.cachePath, 'components-properties.json');

         const [error, collectWords] = await execInPool(
            taskParameters.pool,
            'collectWords',
            [moduleInfo.path, file.path, componentsPropertiesFilePath],
            file.path,
            moduleInfo
         );
         if (error) {
            logger.warning({
               message: 'Ошибка при обработке файла',
               filePath: file.path,
               error,
               moduleInfo
            });
         } else {
            cache.storeCollectWords(file.history[0], collectWords);
         }
      } catch (error) {
         logger.warning({
            message: "Ошибка builder'а при обработке файла",
            filePath: file.path,
            error,
            moduleInfo
         });
      }
      callback();
   });
};
