/* eslint-disable no-invalid-this */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   helpers = require('../../../lib/helpers'),
   transliterate = require('../../../lib/transliterate');

module.exports = function(moduleInfo) {
   return through.obj(function(file, encoding, callback) {
      callback(null, file);
   }, function(callback) {
      try {
         //подготовим contents.json и contents.js
         moduleInfo.contents.modules[moduleInfo.folderName] = transliterate(moduleInfo.folderName);

         const contentsJsFile = new Vinyl({
            path: 'contents.js',
            contents: Buffer.from('contents=' + JSON.stringify(helpers.sortObject(moduleInfo.contents))),
            moduleInfo: moduleInfo
         });
         const contentsJsonFile = new Vinyl({
            path: 'contents.json',
            contents: Buffer.from(JSON.stringify(helpers.sortObject(moduleInfo.contents), null, 2)),
            moduleInfo: moduleInfo
         });

         this.push(contentsJsFile);
         this.push(contentsJsonFile);
      } catch (error) {
         logger.error({
            message: 'Ошибка Builder\'а',
            error: error,
            moduleInfo: moduleInfo
         });
      }
      callback();
   });
};
