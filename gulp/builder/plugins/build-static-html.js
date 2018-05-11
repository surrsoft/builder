/* eslint-disable no-invalid-this */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   path = require('path'),
   transliterate = require('../../../lib/transliterate'),
   generateStaticHtmlForJs = require('../../../lib/generate-static-html-for-js'),
   logger = require('../../../lib/logger').logger();

module.exports = function(changesStore, moduleInfo, modulesMap) {
   return through.obj(function(file, encoding, callback) {
      callback(null, file);
   }, async function(callback) {
      try {
         const config = {}; //TODO:нужно доработать для desktop приложений
         const componentsInfo = changesStore.getComponentsInfo(moduleInfo.name);
         const promises = Object.keys(componentsInfo).map(async(filePath) => {
            try {
               const result = await generateStaticHtmlForJs(filePath, componentsInfo[filePath], moduleInfo.contents, config, modulesMap, false);
               if (result) {
                  result.source = filePath;
               }
               return result;
            } catch (error) {
               logger.error({
                  message: 'Ошибка при генерации статической html для JS',
                  filePath: filePath,
                  error: error,
                  moduleInfo: moduleInfo
               });
            }
            return null;
         });
         const results = await Promise.all(promises);
         for (const result of results) {
            if (result) {
               const folderName = transliterate(moduleInfo.folderName);
               moduleInfo.staticTemplates[result.outFileName] = path.join(folderName, result.outFileName);
               const outputPath = path.join(moduleInfo.output, result.outFileName);
               changesStore.addOutputFile(result.source, outputPath);
               this.push(new Vinyl({
                  base: moduleInfo.output,
                  path: outputPath,
                  contents: Buffer.from(result.text)
               }));
            }
         }
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
