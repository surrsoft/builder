'use strict';

const logger = require('../../../lib/logger').logger(),
   through = require('through2');

module.exports = function() {
   return through.obj(function(file, encoding, callback) {
      try {
         if (!file.hasOwnProperty('cached') || !file.cached) {
            this.push(file); //eslint-disable-line no-invalid-this
         }
      } catch (error) {
         logger.error({error: error});
      }
      callback();
   });
};
