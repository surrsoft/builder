/* eslint-disable no-invalid-this */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   path = require('path'),
   transliterate = require('../../lib/transliterate'),
   helpers = require('../../lib/helpers'),
   generateStaticHtmlForJs = require('../../lib/generate-static-html-for-js'),
   logger = require('../../lib/logger').logger();

module.exports = function(moduleInfo, modulesMap) {
   return through.obj(async function(file, encoding, callback) {
      this.push(file);

      try {
         if (!file.hasOwnProperty('componentInfo')) {
            //не компонент js
            callback();
            return;
         }

         const config = {}; //TODO:

         const result = await generateStaticHtmlForJs(file.history[0], file.componentInfo, moduleInfo.contents, config, modulesMap, false);

         if (result) {
            const folderName = transliterate(moduleInfo.folderName);
            moduleInfo.staticTemplates[result.outFileName] = path.join(folderName, result.outFileName);
            this.push(new Vinyl({
               base: moduleInfo.output,
               path: path.join(moduleInfo.output, result.outFileName),
               contents: Buffer.from(result.text)
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
   }, function(callback) {
      if (Object.keys(moduleInfo.staticTemplates).length > 0) {
         const file = new Vinyl({
            path: 'static_templates.json',
            contents: Buffer.from(JSON.stringify(helpers.sortObject(moduleInfo.staticTemplates), null, 2)),
            moduleInfo: moduleInfo
         });
         callback(null, file);
         return;
      }
      callback(null);
   });
};
