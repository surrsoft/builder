/* eslint-disable no-invalid-this */

'use strict';

const logger = require('../../lib/logger').logger(),
   through = require('through2');

module.exports = function(changesStore, moduleInfo) {
   return through.obj(function(file, encoding, callback) {
      try {
         if (changesStore.isFileChanged(file.path, file.stat.mtime, moduleInfo)) {
            this.push(file);
         }
      } catch (error) {
         logger.error({error: error});
      }
      callback();
   });
};
