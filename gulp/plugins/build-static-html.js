'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   path = require('path'),
   generateStaticHtmlForJs = require('../../lib/generate-static-html-for-js'),
   logger = require('../../lib/logger').logger();

module.exports = function(moduleInfo, modulesMap) {
   return through.obj(async function(file, encoding, callback) {
      this.push(file);

      try {
         if (!file.hasOwnProperty('componentInfo')) {
            //не компонент js
            return callback();
         }

         const config = {};
         const result = await generateStaticHtmlForJs(file.history[0], file.componentInfo, moduleInfo.contents, config, modulesMap, true);
         if (result) {
            this.push(new Vinyl({
               base: moduleInfo.output,
               path: path.join(moduleInfo.output, result.outFileName),
               contents: new Buffer(result.text)
            }));
         }
      } catch (error) {
         logger.error({
            message: 'Ошибка при генерации статической html для JS',
            filePath: file.history[0],
            error: error,
            moduleInfo: moduleInfo
         });
      }
      callback();
   });
};
