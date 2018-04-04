/* eslint-disable no-invalid-this */

'use strict';

const logger = require('../../../lib/logger').logger(),
   through = require('through2');

//moduleInfo может отсутствовать
module.exports = function(cache, moduleInfo) {
   return through.obj(async function(file, encoding, callback) {
      try {
         const isChanged = cache.isFileChanged(file.path, file.stat.mtime, moduleInfo);
         if (isChanged instanceof Promise) {
            file.cached = !await isChanged;
         } else {
            file.cached = !isChanged;
         }
      } catch (error) {
         logger.error({error: error});
      }
      callback(null, file);
   });
};
