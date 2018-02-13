'use strict';

const path = require('path'),
   through = require('through2');

function processFileByModifiedTime(stream, file, modulePath, changesStore) {
   const mtime = file.stat && file.stat.mtime,
      newTime = mtime.getTime(),
      filePath = path.relative(modulePath, file.path);

   let oldTime;

   if (changesStore.store.hasOwnProperty(modulePath)) {
      changesStore.store[modulePath].exist = true;
      const files = changesStore.store[modulePath].files;
      if (files.hasOwnProperty(filePath)) {
         oldTime = files[filePath].time;
      } else {
         files[filePath] = {};
      }
      files[filePath].time = newTime;
      files[filePath].exist = true;
   } else {
      changesStore.store[modulePath] = {
         'files': {
            [filePath]: {
               time: newTime,
               exist: true
            }
         },
         'exist': true
      };
   }

   if (!oldTime || oldTime !== newTime) {
      stream.push(file);
   }
}

module.exports = function(changesStore, modulePath) {
   return through.obj(function(file, encoding, callback) {
      //TODO: не нужно ли перейти на sha1, например?
      processFileByModifiedTime(this, file, modulePath, changesStore);
      callback();
   });
};
