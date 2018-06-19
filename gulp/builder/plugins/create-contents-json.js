/**
 * Плагин для создания contents.json и contents.js (информация для require, описание локализации и т.д.)
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   helpers = require('../../../lib/helpers'),
   transliterate = require('../../../lib/transliterate');

/**
 * Объявление плагина
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {*}
 */
module.exports = function declarePlugin(config, moduleInfo) {
   return through.obj(
      function onTransform(file, encoding, callback) {
         callback(null, file);
      },

      /* @this Stream */
      function onFlush(callback) {
         try {
            // подготовим contents.json и contents.js
            moduleInfo.contents.modules[moduleInfo.folderName] = transliterate(moduleInfo.folderName);

            if (config.version) {
               moduleInfo.contents.buildnumber = config.version;
            }

            const contentsJsFile = new Vinyl({
               path: 'contents.js',
               contents: Buffer.from(`contents=${JSON.stringify(helpers.sortObject(moduleInfo.contents))}`),
               moduleInfo
            });
            const contentsJsonFile = new Vinyl({
               path: 'contents.json',
               contents: Buffer.from(JSON.stringify(helpers.sortObject(moduleInfo.contents), null, 2)),
               moduleInfo
            });

            this.push(contentsJsFile);
            this.push(contentsJsonFile);
         } catch (error) {
            logger.error({
               message: "Ошибка Builder'а",
               error,
               moduleInfo
            });
         }
         callback();
      }
   );
};
