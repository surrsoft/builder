'use strict';

const logger = require('../../../lib/logger').logger(),
   through = require('through2');

// moduleInfo может отсутствовать
module.exports = function declarePlugin(cache, moduleInfo) {
   return through.obj(async(file, encoding, callback) => {
      try {
         const isChanged = cache.isFileChanged(file.path, file.stat.mtime, moduleInfo);
         if (isChanged instanceof Promise) {
            file.cached = !(await isChanged);
         } else {
            file.cached = !isChanged;
         }
      } catch (error) {
         logger.error({ error });
      }
      callback(null, file);
   });
};
