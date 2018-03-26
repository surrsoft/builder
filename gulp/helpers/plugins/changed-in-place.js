/* eslint-disable no-invalid-this */

'use strict';

const logger = require('../../../lib/logger').logger(),
   through = require('through2');

//moduleInfo может отсутствовать
module.exports = function(cache, moduleInfo) {
   return through.obj(function(file, encoding, callback) {
      try {
         if (cache.isFileChanged(file.path, file.stat.mtime, moduleInfo)) {
            this.push(file);
         }
      } catch (error) {
         logger.error({error: error});
      }
      callback();
   });
};
