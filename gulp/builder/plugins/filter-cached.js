'use strict';

const logger = require('../../../lib/logger').logger(),
   through = require('through2');

module.exports = function() {
   return through.obj(function(file, encoding, callback) {
      try {
         if (!file.hasOwnProperty('cached') || !file.cached) {
            callback(null, file);
            return;
         }
      } catch (error) {
         logger.error({ error: error });
      }
      callback();
   });
};
