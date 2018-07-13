/**
 * Плагин для минификации простейших случаев: *.json, *.jstpl
 * Заводить для каждого из них отдельный плагин - лишняя работа.
 * Включать в minify-js - значит усложнить и без того сложный плагин.
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

const includeExts = ['.jstpl', '.json'];

const excludeRegexes = [/.*\.package\.json$/, /[/\\]node_modules[/\\].*/];

/**
 * Объявление плагина
 * @param {ChangesStore} changesStore кеш
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {*}
 */
module.exports = function declarePlugin(changesStore, moduleInfo) {
   return through.obj(

      /* @this Stream */
      function onTransform(file, encoding, callback) {
         const
            isJsonJs = file.basename.endsWith('.json.js'),
            needToLog = isJsonJs && file.path.includes('WS.Core');

         if (needToLog) {
            logger.info({
               message: 'Файл удовлетворяет требованиям amd-json-модуля',
               filePath: file.path
            });
         }
         try {
            if (!isJsonJs) {
               if (!includeExts.includes(file.extname)) {
                  callback(null, file);
                  return;
               }
            }


            for (const regex of excludeRegexes) {
               if (regex.test(file.path)) {
                  callback(null, file);
                  return;
               }
            }

            const
               currentFilePath = isJsonJs ? file.history[0].replace('.json', '.json.js') : file.history[0],
               currentExt = isJsonJs ? '.json.js' : file.extname,
               minFileExt = isJsonJs ? '.json.min.js' : `.min${file.extname}`;

            const relativePath = path
               .relative(moduleInfo.path, currentFilePath)
               .replace(currentExt, minFileExt);
            const outputMinFile = path.join(moduleInfo.output, transliterate(relativePath));

            if (needToLog) {
               logger.info({
                  message: 'Дошли до обработки jsonjs внутри minify-other\n' +
                  `currentFilePath: ${currentFilePath},\n` +
                  `currentExt: ${currentExt},\n` +
                  `minFileExt: ${minFileExt},\n` +
                  `relativePath: ${relativePath},\n` +
                  `outputMinFile: ${outputMinFile},\n` +
                  `isCached: ${file.cached}`,
                  filePath: file.path
               });
            }

            if (file.cached) {
               changesStore.addOutputFile(file.history[0], outputMinFile, moduleInfo);
               callback(null, file);
               return;
            }

            if (needToLog) {
               logger.info({
                  message: 'Дошли до минификации jsonjs',
                  filePath: file.path
               });
            }

            /**
             * если json файл не возможно минифицировать, то запишем оригинал.
             * jstpl копируем напрямую, их минифицировать никак нельзя,
             * но .min файл присутствовать должен во избежание ошибки 404
             */
            let newText = file.contents.toString();

            if (file.extname === '.json') {
               try {
                  newText = JSON.stringify(JSON.parse(newText));
               } catch (error) {
                  changesStore.markFileAsFailed(file.history[0]);
                  logger.error({
                     message: 'Ошибка минификации файла',
                     error,
                     moduleInfo,
                     filePath: file.path
                  });
               }
            }

            this.push(
               new Vinyl({
                  base: moduleInfo.output,
                  path: outputMinFile,
                  contents: Buffer.from(newText)
               })
            );
            changesStore.addOutputFile(file.history[0], outputMinFile, moduleInfo);
         } catch (error) {
            changesStore.markFileAsFailed(file.history[0]);
            logger.error({
               message: "Ошибка builder'а при минификации",
               error,
               moduleInfo,
               filePath: file.path
            });
         }
         callback(null, file);
      }
   );
};
