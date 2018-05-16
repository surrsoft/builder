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
         if (file.extname !== '.xhtml') {
            callback(null, file);
            return;
         }
         const relativePath = path.relative(moduleInfo.path, file.history[0]).replace(/\.xhtml/, '.min.xhtml');
         const outputMinFile = path.join(moduleInfo.output, transliterate(relativePath));

         if (file.cached) {
            changesStore.addOutputFile(file.history[0], outputMinFile);
            callback(null, file);
            return;
         }

         //если xhtml не возможно скомпилировать, то запишем оригинал
         let newText = file.contents.toString();
         let relativeFilePath = path.relative(moduleInfo.path, file.history[0]);
         relativeFilePath = path.join(path.basename(moduleInfo.path), relativeFilePath);
         try {

            newText = (await pool.exec('buildXhtml', [newText, relativeFilePath])).text;

            //если xhtml не возможно минифицировать, то запишем оригинал
            try {
               newText = (await pool.exec('uglifyJs', [file.path, newText, true])).code;
            } catch (error) {
               changesStore.markFileAsFailed(file.history[0]);
               logger.error({
                  message: 'Ошибка минификации скомпилированного XHTML',
                  error: error,
                  moduleInfo: moduleInfo,
                  filePath: relativeFilePath.replace('.xhtml', '.min.xhtml')
               });
            }
         } catch (error) {
            changesStore.markFileAsFailed(file.history[0]);
            logger.error({
               message: 'Ошибка компиляции XHTML',
               error: error,
               moduleInfo: moduleInfo,
               filePath: relativeFilePath
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
         changesStore.markFileAsFailed(file.history[0]);
         logger.error({
            message: 'Ошибка builder\'а при компиляции XHTML',
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
