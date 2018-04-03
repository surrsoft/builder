/* eslint-disable no-invalid-this */

'use strict';

const logger = require('../../../lib/logger').logger(),
   through = require('through2');

//moduleInfo может отсутствовать
module.exports = function(cache, moduleInfo) {
   return through.obj(function(file, encoding, callback) {
      try {
         file.cached = !cache.isFileChanged(file.path, file.stat.mtime, moduleInfo);
      } catch (error) {
         logger.error({error: error});
      }
      callback(null, file);
   });
};
