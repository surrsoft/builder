/**
 * Плагин для минификации js.
 * JS с учётом паковки собственных зависимостей и минификации может быть представлен тремя или пятью файлами.
 * Simple.js без верстки в зависимостях:
 *   - Simple.js - оригинал
 *   - Simple.min.js - минифицированный файл по Simple.js
 *   - Simple.min.js.map - source map для Simple.min.js по Simple.js
 * Simple.js с версткой в зависимостях:
 *   - Simple.js - оригинал
 *   - Simple.modulepack.js - файл с пакованными зависимостями вёрстки
 *   - Simple.min.original.js - минифицированный файл по Simple.js. Для rt паковки.
 *   - Simple.min.js - минифицированный файл по Simple.modulepack.js
 *   - Simple.min.js.map - source map для Simple.min.js по Simple.modulepack.js
 *
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate'),
   execInPool = require('../../common/exec-in-pool'),
   esExt = /\.(es|ts)$/;

const excludeRegexes = [
   /.*\.min\.js$/,
   /.*\.routes\.js$/,
   /.*\.test\.js$/,

   // https://online.sbis.ru/opendoc.html?guid=05e7f1be-9fa9-48d4-a0d9-5506ac8d2b12
   /.*\.json\.js$/,
   /.*\.worker\.js$/,
   /.*[/\\]node_modules[/\\].*/,
   /.*[/\\]ServerEvent[/\\]worker[/\\].*/,

   // https://online.sbis.ru/opendoc.html?guid=761eb095-c7be-437d-ab0c-c5058de852a4
   /.*[/\\]EDO2[/\\]Route[/\\].*/,

   // WS.Core/ext/requirejs/r.js используется только для юнит тестов и, возможно, в препроцессоре.
   // не нужно его минимизировать.
   // https://online.sbis.ru/opendoc.html?guid=02ee2490-afc0-4841-a084-b14aaca64e9c
   /.*[/\\]WS\.Core[/\\]ext[/\\]requirejs[/\\]r\.js/
];

/**
 * Объявление плагина
 * @param {TaskParameters} taskParameters параметры для задач
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {stream}
 */
module.exports = function declarePlugin(taskParameters, moduleInfo) {
   return through.obj(

      /* @this Stream */
      async function onTransform(file, encoding, callback) {
         try {
            if (file.extname !== '.js') {
               callback(null, file);
               return;
            }

            for (const regex of excludeRegexes) {
               if (regex.test(file.path)) {
                  callback(null, file);
                  return;
               }
            }

            const extName = esExt.test(file.history[0]) ? esExt : file.extname;
            const relativePathWoExt = path.relative(moduleInfo.path, file.history[0]).replace(extName, '');
            const outputFileWoExt = path.join(moduleInfo.output, transliterate(relativePathWoExt));
            const outputMinJsFile = `${outputFileWoExt}.min.js`;
            const outputMinOriginalJsFile = `${outputFileWoExt}.min.original.js`;
            const outputMinJsMapFile = `${outputFileWoExt}.min.js.map`;
            const outputModulepackJsFile = `${outputFileWoExt}.modulepack.js`;

            if (file.cached) {
               taskParameters.cache.addOutputFile(file.history[0], outputMinJsFile, moduleInfo);
               taskParameters.cache.addOutputFile(file.history[0], outputMinOriginalJsFile, moduleInfo);
               taskParameters.cache.addOutputFile(file.history[0], outputMinJsMapFile, moduleInfo);
               taskParameters.cache.addOutputFile(file.history[0], outputModulepackJsFile, moduleInfo);
               callback(null, file);
               return;
            }

            if (!file.modulepack) {
               // если файл не возможно минифицировать, то запишем оригинал
               let minText = file.contents.toString();
               const [error, minified] = await execInPool(taskParameters.pool, 'uglifyJs', [
                  file.path,
                  minText,
                  false,
                  path.basename(outputMinJsMapFile)
               ]);
               if (error) {
                  taskParameters.cache.markFileAsFailed(file.history[0]);
                  logger.error({
                     message: 'Ошибка минификации файла',
                     error,
                     moduleInfo,
                     filePath: file.path
                  });
               } else {
                  minText = minified.code;
                  if (minified.hasOwnProperty('map') && minified.map) {
                     this.push(
                        new Vinyl({
                           base: moduleInfo.output,
                           path: outputMinJsMapFile,
                           contents: Buffer.from(minified.map)
                        })
                     );
                     taskParameters.cache.addOutputFile(file.history[0], outputMinJsMapFile, moduleInfo);
                  }
               }
               this.push(
                  new Vinyl({
                     base: moduleInfo.output,
                     path: outputMinJsFile,
                     contents: Buffer.from(minText)
                  })
               );
               taskParameters.cache.addOutputFile(file.history[0], outputMinJsFile, moduleInfo);
            } else {
               // минимизируем оригинальный JS
               // если файл не возможно минифицировать, то запишем оригинал
               let minOriginalText = file.contents.toString();
               const [errorOriginal, minifiedOriginal] = await execInPool(taskParameters.pool, 'uglifyJs', [
                  file.path,
                  minOriginalText,
                  false,
                  path.basename(outputMinJsMapFile)
               ]);
               if (errorOriginal) {
                  taskParameters.cache.markFileAsFailed(file.history[0]);
                  logger.error({
                     message: 'Ошибка минификации файла',
                     error: errorOriginal,
                     moduleInfo,
                     filePath: file.path
                  });
               } else {
                  minOriginalText = minifiedOriginal.code;
               }
               this.push(
                  new Vinyl({
                     base: moduleInfo.output,
                     path: outputMinOriginalJsFile,
                     contents: Buffer.from(minOriginalText)
                  })
               );
               taskParameters.cache.addOutputFile(file.history[0], outputMinOriginalJsFile, moduleInfo);

               // минимизируем JS c пакованными зависимостями
               // если файл не возможно минифицировать, то запишем оригинал
               let minText = file.modulepack;
               this.push(
                  new Vinyl({
                     base: moduleInfo.output,
                     path: outputModulepackJsFile,
                     contents: Buffer.from(file.modulepack)
                  })
               );
               taskParameters.cache.addOutputFile(file.history[0], outputModulepackJsFile, moduleInfo);

               const [error, minified] = await execInPool(taskParameters.pool, 'uglifyJs', [
                  file.path,
                  minText,
                  false,
                  path.basename(outputMinJsMapFile)
               ]);
               if (error) {
                  taskParameters.cache.markFileAsFailed(file.history[0]);
                  logger.error({
                     message: 'Ошибка минификации файла',
                     error,
                     moduleInfo,
                     filePath: outputModulepackJsFile
                  });
               } else {
                  minText = minified.code;
                  if (minified.hasOwnProperty('map') && minified.map) {
                     this.push(
                        new Vinyl({
                           base: moduleInfo.output,
                           path: outputMinJsMapFile,
                           contents: Buffer.from(minified.map)
                        })
                     );
                     taskParameters.cache.addOutputFile(file.history[0], outputMinJsMapFile, moduleInfo);
                  }
               }
               this.push(
                  new Vinyl({
                     base: moduleInfo.output,
                     path: outputMinJsFile,
                     contents: Buffer.from(minText)
                  })
               );
               taskParameters.cache.addOutputFile(file.history[0], outputMinJsFile, moduleInfo);
            }
         } catch (error) {
            taskParameters.cache.markFileAsFailed(file.history[0]);
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
