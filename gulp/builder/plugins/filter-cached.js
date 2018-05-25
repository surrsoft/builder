'use strict';

const logger = require('../../../lib/logger').logger(),
   through = require('through2');

module.exports = function declarePlugin() {
   return through.obj(function onTransform(file, encoding, callback) {
      try {
         if (!file.hasOwnProperty('cached') || !file.cached) {
            callback(null, file);
            return;
         }
      } catch (error) {
         logger.error({ error });
      }
      callback();
   });
};
