'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   helpers = require('../../../lib/helpers');

module.exports = function declarePlugin(moduleInfo) {
   return through.obj(
      function onTransform(file, encoding, callback) {
         callback(null, file);
      },

      /** @this Stream */
      function onFlush(callback) {
         try {
            // Всегда сохраняем файл, чтобы не было ошибки при удалении последней статической html страницы в модуле.
            const file = new Vinyl({
               path: 'static_templates.json',
               contents: Buffer.from(JSON.stringify(helpers.sortObject(moduleInfo.staticTemplates), null, 2)),
               moduleInfo
            });
            this.push(file);
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
