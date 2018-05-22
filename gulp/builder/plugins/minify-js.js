/* eslint-disable no-invalid-this */
'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

const excludeRegexes = [
   /.*\.min\.js$/,
   /.*\.routes\.js$/,
   /.*\.test\.js$/,
   /.*\/node_modules\/.*/,
   /.*\/ServerEvent\/worker\/.*/,

   //https://online.sbis.ru/opendoc.html?guid=761eb095-c7be-437d-ab0c-c5058de852a4
   /.*\/EDO2\/Route\/.*/
];

function to(promise) {
   return (
      promise
         //eslint-disable-next-line promise/prefer-await-to-then
         .then(data => {
            return [null, data];
         })
         .catch(err => [err])
   );
}

/*
 * JS с учётом паковки собственных зависимостей и минификации может быть представлен тремя или пятью файлами.
 * Simple.js без верстки в зависимостях:
 *   - Simple.js - оригинал
 *   - Simple.min.js - минифицированный файл по Simple.js
 *   - Simple.min.js.map - source map для Simple.min.js по Simple.js
 * Simple.js с версткой в зависимостях:
 *   - Simple.js - оригинал
 *   - Simple.modulepack.js - файл с пакованными зависимостями вёрстки
 *   - Simple.min.original.js - минифицированный файл по Simple.js. Для rt паковки.
 *   - Simple.min.js - минифицированный файл по Simple.min.modulepack.js
 *   - Simple.min.js.map - source map для Simple.min.js по Simple.min.modulepack.js
 */
module.exports = function(changesStore, moduleInfo, pool) {
   return through.obj(async function(file, encoding, callback) {
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

         const relativePathWoExt = path.relative(moduleInfo.path, file.history[0]).replace(file.extname, '');
         const outputFileWoExt = path.join(moduleInfo.output, transliterate(relativePathWoExt));
         const outputMinJsFile = outputFileWoExt + '.min.js';
         const outputMinOriginalJsFile = outputFileWoExt + '.min.original.js';
         const outputMinJsMapFile = outputFileWoExt + '.min.js.map';
         const outputModulepackJsFile = outputFileWoExt + '.modulepack.js';

         if (file.cached) {
            changesStore.addOutputFile(file.history[0], outputMinJsFile);
            changesStore.addOutputFile(file.history[0], outputMinOriginalJsFile);
            changesStore.addOutputFile(file.history[0], outputMinJsMapFile);
            changesStore.addOutputFile(file.history[0], outputModulepackJsFile);
            callback(null, file);
            return;
         }

         if (!file.modulepack) {
            //если файл не возможно минифицировать, то запишем оригинал
            let minText = file.contents.toString();
            const [error, minified] = await to(
               pool.exec('uglifyJs', [file.path, minText, false, path.basename(outputMinJsFile)])
            );
            if (error) {
               changesStore.markFileAsFailed(file.history[0]);
               logger.error({
                  message: 'Ошибка минификации файла',
                  error: error,
                  moduleInfo: moduleInfo,
                  filePath: file.path
               });
            } else {
               minText = minified.code;
               if (minified.hasOwnProperty('map') && minified.map) {
                  this.push(
                     new Vinyl({
                        base: moduleInfo.output,
                        path: outputMinJsFile,
                        contents: Buffer.from(minified.map)
                     })
                  );
                  changesStore.addOutputFile(file.history[0], outputMinJsMapFile);
               }
            }
            this.push(
               new Vinyl({
                  base: moduleInfo.output,
                  path: outputMinJsFile,
                  contents: Buffer.from(minText)
               })
            );
            changesStore.addOutputFile(file.history[0], outputMinJsFile);
         } else {
            //минимизируем оригинальный JS
            //если файл не возможно минифицировать, то запишем оригинал
            let minOriginalText = file.contents.toString();
            const [errorOriginal, minifiedOriginal] = await to(
               pool.exec('uglifyJs', [file.path, minOriginalText, false])
            );
            if (errorOriginal) {
               changesStore.markFileAsFailed(file.history[0]);
               logger.error({
                  message: 'Ошибка минификации файла',
                  error: errorOriginal,
                  moduleInfo: moduleInfo,
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
            changesStore.addOutputFile(file.history[0], outputMinJsFile);

            //минимизируем JS c пакованными зависимостями
            //если файл не возможно минифицировать, то запишем оригинал
            let minText = file.modulepack;
            this.push(
               new Vinyl({
                  base: moduleInfo.output,
                  path: outputModulepackJsFile,
                  contents: Buffer.from(file.modulepack)
               })
            );

            const [error, minified] = await to(
               pool.exec('uglifyJs', [file.path, minText, false, path.basename(outputMinJsMapFile)])
            );
            if (error) {
               changesStore.markFileAsFailed(file.history[0]);
               logger.error({
                  message: 'Ошибка минификации файла',
                  error: error,
                  moduleInfo: moduleInfo,
                  filePath: outputModulepackJsFile
               });
            } else {
               minText = minified.code;
               if (minified.hasOwnProperty('map') && minified.map) {
                  this.push(
                     new Vinyl({
                        base: moduleInfo.output,
                        path: outputMinJsFile,
                        contents: Buffer.from(minified.map)
                     })
                  );
                  changesStore.addOutputFile(file.history[0], outputMinJsMapFile);
               }
            }
            this.push(
               new Vinyl({
                  base: moduleInfo.output,
                  path: outputMinJsFile,
                  contents: Buffer.from(minText)
               })
            );
            changesStore.addOutputFile(file.history[0], outputMinJsFile);
         }
      } catch (error) {
         changesStore.markFileAsFailed(file.history[0]);
         logger.error({
            message: "Ошибка builder'а при минификации",
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
