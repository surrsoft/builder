'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../lib/logger').logger(),
   transliterate = require('../../lib/transliterate');

module.exports = function(moduleInfo) {
   return through.obj(function(file, encoding, callback) {
      file.moduleInfo = moduleInfo;
      this.push(file);
      callback();
   }, function(callback) {
      try {
         moduleInfo.contents.modules[moduleInfo.folderName] = transliterate(moduleInfo.folderName);

         const contentsText = JSON.stringify(moduleInfo.contents, null, 3);
         const contentsJsFile = new Vinyl({
            path: 'contents.js',
            contents: new Buffer('contents=' + contentsText),
            moduleInfo: moduleInfo
         });
         const contentsJsonFile = new Vinyl({
            path: 'contents.json',
            contents: new Buffer(contentsText),
            moduleInfo: moduleInfo
         });

         this.push(contentsJsFile);
         this.push(contentsJsonFile);
      } catch (error) {
         logger.error({
            message: 'Ошибка при записи contents.json',
            error: error,
            moduleInfo: moduleInfo
         });
      }
      callback();
   });
};
