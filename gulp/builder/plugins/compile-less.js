/* eslint-disable no-invalid-this */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   fs = require('fs-extra'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

module.exports = function(changesStore, moduleInfo, pool, sbis3ControlsPath) {
   return through.obj(async function(file, encoding, callback) {
      if (file.cached) {
         callback(null, file);
         return;
      }
      this.push(file);
      if (!file.path.endsWith('.less')) {
         callback();
         return;
      }
      try {
         const cssInSources = file.history[0].replace(/\.less$/, '.css');
         if (await fs.pathExists(cssInSources)) {
            const message = `Существующий CSS-файл мешает записи результата компиляции '${file.path}'. ` +
               'Необходимо удалить лишний CSS-файл';
            logger.warning({
               message: message,
               filePath: cssInSources,
               moduleInfo: moduleInfo
            });
            callback();
            return;
         }

         let result;
         try {
            result = await pool.exec('buildLess', [file.history[0], file.contents.toString(), moduleInfo.path, sbis3ControlsPath]);
         } catch (error) {
            logger.warning({
               error: error,
               filePath: file.history[0],
               moduleInfo: moduleInfo
            });
            callback();
            return;
         }

         if (result.ignoreMessage) {
            logger.debug(result.ignoreMessage);
         } else {
            //changesStore.storeLessFileInfo(result.path, result.imports, result.path.replace('.less', '.css'));
            const relativePath = path.relative(moduleInfo.path, file.history[0]).replace(/\.less$/, '.css');
            this.push(new Vinyl({
               base: moduleInfo.output,
               path: path.join(moduleInfo.output, transliterate(relativePath)),
               contents: Buffer.from(result.text)
            }));
         }
      } catch (error) {
         logger.error({
            message: 'Ошибка builder\'а при компиляции less',
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.history[0]
         });
      }
      callback();
   });
};
