'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../lib/logger').logger(),
   transliterate = require('../../lib/transliterate'),
   processingRoutes = require('../../lib/processing-routes');

module.exports = function(moduleInfo) {
   return through.obj(function(file, encoding, callback) {
      file.moduleInfo = moduleInfo;
      this.push(file);
      callback();
   }, function(callback) {
      try {
         //подготовим contents.json и contents.js
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

         //подготовим routes-info.json
         processingRoutes.prepareToSave(moduleInfo.routesInfo, Object.keys(moduleInfo.contents.jsModules));
         const routesInfoText = JSON.stringify(moduleInfo.routesInfo, null, 3);
         const routesInfoFile = new Vinyl({
            path: 'routes-info.json',
            contents: new Buffer(routesInfoText),
            moduleInfo: moduleInfo
         });
         this.push(routesInfoFile);

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
