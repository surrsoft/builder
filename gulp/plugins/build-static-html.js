'use strict';

const through = require('through2'),
   path = require('path'),
   generateStaticHtmlForJs = require('../../lib/generate-static-html-for-js'),
   logger = require('../../lib/logger').logger();

module.exports = function(moduleInfo) {
   return through.obj(async function(file, encoding, callback) {
      this.push(file);

      try {
         if (!file.hasOwnProperty('componentInfo')) {
            //не компонент js
            return callback();
         }

         const config = {};
         const resourcesRoot = path.dirname(moduleInfo.output);
         const result = await generateStaticHtmlForJs(file.componentInfo, moduleInfo.contents, config, resourcesRoot, true);
         if (result) {
            const htmlFile = file.clone({contents: false});
            htmlFile.contents = new Buffer(result.text);
            htmlFile.path = path.join(moduleInfo.output, result.outFileName);
            this.push(htmlFile);
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
