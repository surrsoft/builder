/* eslint-disable no-invalid-this */
'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

module.exports = function(changesStore, moduleInfo, pool) {
   return through.obj(async function(file, encoding, callback) {
      try {
         if (!['.js', '.json', '.css'].includes(file.extname)) {
            callback(null, file);
            return;
         }
         const relativePath = path.relative(moduleInfo.path, file.history[0]).replace(file.extname, '.min' + file.extname);
         const outputMinFile = path.join(moduleInfo.output, transliterate(relativePath));

         if (file.cached) {
            changesStore.addOutputFile(file.history[0], outputMinFile);
            callback(null, file);
            return;
         }

         //если файл не возможно минифицировать, то запишем оригинал
         let newText = file.contents.toString();
         try {
            let relativeFilePath = path.relative(moduleInfo.path, file.history[0]);
            relativeFilePath = path.join(path.basename(moduleInfo.path), relativeFilePath);

            newText = await pool.exec('uglify', [newText, relativeFilePath]);
         } catch (error) {
            logger.warning({
               message: 'Ошибка минификации файла',
               error: error,
               moduleInfo: moduleInfo,
               filePath: file.path
            });
         }

         this.push(
            new Vinyl({
               base: moduleInfo.output,
               path: outputMinFile,
               contents: Buffer.from(newText)
            })
         );
         changesStore.addOutputFile(file.history[0], outputMinFile);
      } catch (error) {
         logger.error({
            message: 'Ошибка builder\'а при минификации',
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
