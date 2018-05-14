/* eslint-disable no-invalid-this */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   fs = require('fs-extra'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

module.exports = function(changesStore, moduleInfo, pool, sbis3ControlsPath, pathsForImport) {
   return through.obj(async function(file, encoding, callback) {
      try {
         if (!file.path.endsWith('.less')) {
            callback(null, file);
            return;
         }

         const relativePath = path.relative(moduleInfo.path, file.history[0]).replace(/\.less$/, '.css');
         const outputPath = path.join(moduleInfo.output, transliterate(relativePath));

         if (file.cached) {
            changesStore.addOutputFile(file.history[0], outputPath);
            callback(null, file);
            return;
         }

         const cssInSources = file.history[0].replace(/\.less$/, '.css');
         if (await fs.pathExists(cssInSources)) {
            changesStore.markFileAsFailed(file.history[0]);
            const message =
               `Существующий CSS-файл мешает записи результата компиляции '${file.path}'. ` +
               'Необходимо удалить лишний CSS-файл';
            logger.warning({
               message: message,
               filePath: cssInSources,
               moduleInfo: moduleInfo
            });
            callback(null, file);
            return;
         }

         let result;
         try {
            result = await pool.exec('buildLess', [
               file.history[0],
               file.contents.toString(),
               moduleInfo.path,
               sbis3ControlsPath,
               pathsForImport
            ]);
         } catch (error) {
            changesStore.markFileAsFailed(file.history[0]);
            logger.warning({
               error: error,
               filePath: file.history[0],
               moduleInfo: moduleInfo
            });
            callback(null, file);
            return;
         }

         if (result.ignoreMessage) {
            logger.debug(result.ignoreMessage);
         } else {
            changesStore.addOutputFile(file.history[0], outputPath);
            changesStore.addDependencies(file.history[0], result.imports);
            this.push(
               new Vinyl({
                  base: moduleInfo.output,
                  path: outputPath,
                  contents: Buffer.from(result.text)
               })
            );
         }
      } catch (error) {
         changesStore.markFileAsFailed(file.history[0]);
         logger.error({
            message: "Ошибка builder'а при компиляции less",
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.history[0]
         });
      }
      callback(null, file);
   });
};
