'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger();

module.exports = function declarePlugin(moduleInfo) {
   return through.obj(
      (file, encoding, callback) => {
         callback(null, file);
      },
      function(callback) {
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
               message: 'Ошибка Builder\'а',
               error,
               moduleInfo
            });
         }
         callback();
      }
   );
};
