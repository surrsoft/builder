/* eslint-disable no-invalid-this */

'use strict';

const logger = require('../../lib/logger').logger(),
   through = require('through2');

module.exports = function(changesStore, moduleInfo) {
   return through.obj(async function(file, encoding, callback) {
      try {
         if (await changesStore.isFileChanged(file.path, file.stat.mtime, moduleInfo)) {
            this.push(file);
         }
      } catch (error) {
         logger.error({error: error});
      }
      callback();
   });
};
