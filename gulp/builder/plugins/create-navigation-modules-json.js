/**
 * Плагин для создания navigation-modules.json (информация для работы аккордеона)
 * @author Kolbeshin F.A.
 */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger();

/**
 * Объявление плагина
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {stream}
 */
module.exports = function declarePlugin(taskParameters, moduleInfo) {
   return through.obj(
      function onTransform(file, encoding, callback) {
         const startTime = Date.now();
         callback(null, file);
         taskParameters.storePluginTime('presentation service meta', startTime);
      },

      /* @this Stream */
      function onFlush(callback) {
         const startTime = Date.now();
         try {
            this.push(
               new Vinyl({
                  path: 'navigation-modules.json',
                  contents: Buffer.from(JSON.stringify(moduleInfo.navigationModules.sort(), null, 2)),
                  moduleInfo
               })
            );
         } catch (error) {
            logger.error({
               message: "Ошибка Builder'а",
               error,
               moduleInfo
            });
         }
         callback();
         taskParameters.storePluginTime('presentation service meta', startTime);
      }
   );
};
