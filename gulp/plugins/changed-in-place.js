/* eslint-disable no-invalid-this */

'use strict';

const logger = require('../../lib/logger').logger(),
   through = require('through2');

module.exports = function(changesStore, moduleInfo) {
   return through.obj(function(file, encoding, callback) {
      try {
         if (changesStore.isFileChanged(file.path, file.stat.mtime, moduleInfo)) {
            console.log(`Файл изменён ${file.path}. mtime = ${file.stat.mtime.getTime()}`);
            this.push(file);
         } else {
            console.log(`Файл не изменён ${file.path}. mtime = ${file.stat.mtime.getTime()}`);
         }
      } catch (error) {
         logger.error({error: error});
      }
      callback();
   });
};
