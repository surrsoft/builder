/* eslint-disable no-invalid-this */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   path = require('path'),
   pMap = require('p-map');
const transliterate = require('../../../lib/transliterate'),
   generateStaticHtmlForJs = require('../../../lib/generate-static-html-for-js'),
   logger = require('../../../lib/logger').logger();

module.exports = function(config, changesStore, moduleInfo, modulesMap) {
   return through.obj(
      (file, encoding, callback) => {
         callback(null, file);
      },
      async function(callback) {
         try {
            const configForReplaceInHTML = {
               urlServicePath: config.urlServicePath,
               wsPath: 'resources/WS.Core/'
            };
            const needReplacePath = !config.multiService;
            const componentsInfo = changesStore.getComponentsInfo(moduleInfo.name);
            const results = await pMap(
               Object.keys(componentsInfo),
               async(filePath) => {
                  try {
                     const result = await generateStaticHtmlForJs(
                        filePath,
                        componentsInfo[filePath],
                        moduleInfo.contents,
                        configForReplaceInHTML,
                        modulesMap,
                        needReplacePath
                     );
                     if (result) {
                        result.source = filePath;
                     }
                     return result;
                  } catch (error) {
                     logger.error({
                        message: 'Ошибка при генерации статической html для JS',
                        filePath,
                        error,
                        moduleInfo
                     });
                  }
                  return null;
               },
               {
                  concurrency: 20
               }
            );
            for (const result of results) {
               if (result) {
                  const folderName = transliterate(moduleInfo.folderName);
                  moduleInfo.staticTemplates[result.outFileName] = path.join(folderName, result.outFileName);
                  const outputPath = path.join(moduleInfo.output, result.outFileName);
                  changesStore.addOutputFile(result.source, outputPath);
                  this.push(
                     new Vinyl({
                        base: moduleInfo.output,
                        path: outputPath,
                        contents: Buffer.from(result.text)
                     })
                  );
               }
            }
         } catch (error) {
            logger.error({
               message: "Ошибка Builder'а",
               error,
               moduleInfo
            });
         }
         callback();
      }
   );
};
