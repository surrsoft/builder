'use strict';

const through = require('through2'),
   generateStaticHtmlForJs = require('../../lib/generate-static-html-for-js'),
   logger = require('../../lib/logger').logger();

module.exports = function() {
   return through.obj(async function(file, encoding, callback) {
      this.push(file);

      try {
         if (!file.hasOwnProperty('componentInfo')) {
            //не компонент js
            callback();
            return;
         }

         const config = {};

         const result = await generateStaticHtmlForJs(file.componentInfo, file.moduleInfo.contents, config, true);
         if (result) {
            const htmlFile = file.clone({contents: false});
            htmlFile.contents = new Buffer(result.text);
            htmlFile.path = result.outputPath;
            this.push(htmlFile);
         }

      } catch (error) {
         logger.error({
            message: 'Ошибка при генерации статической html для JS',
            filePath: file.history[0],
            error: error,
            moduleInfo: file.moduleInfo
         });
      }
      callback();
   });
};
