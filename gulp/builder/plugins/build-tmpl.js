/* eslint-disable no-invalid-this */
'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   minifyTmpl = require('../../../lib/processing-tmpl').minifyTmpl,
   transliterate = require('../../../lib/transliterate');

module.exports = function(config, changesStore, moduleInfo, pool) {
   const componentsPropertiesFilePath = path.join(config.cachePath, 'components-properties.json');

   return through.obj(async function(file, encoding, callback) {
      try {
         if (file.extname !== '.tmpl') {
            callback(null, file);
            return;
         }
         let outputMinFile = '';
         if (config.isReleaseMode) {
            const relativePath = path.relative(moduleInfo.path, file.history[0]).replace(/\.tmpl$/, '.min.tmpl');
            outputMinFile = path.join(moduleInfo.output, transliterate(relativePath));
         }
         if (file.cached) {
            if (outputMinFile) {
               changesStore.addOutputFile(file.history[0], outputMinFile);
            }
            callback(null, file);
            return;
         }

         // если tmpl не возможно скомпилировать, то запишем оригинал
         let newText = file.contents.toString();
         let relativeFilePath = path.relative(moduleInfo.path, file.history[0]);
         relativeFilePath = path.join(path.basename(moduleInfo.path), relativeFilePath);
         try {
            newText = minifyTmpl(newText);
            const result = await pool.exec('buildTmpl', [newText, relativeFilePath, componentsPropertiesFilePath]);
            changesStore.storeBuildedMarkup(file.history[0], moduleInfo.name, result);
            newText = result.text;

            if (config.isReleaseMode) {
               // если tmpl не возможно минифицировать, то запишем оригинал
               try {
                  newText = (await pool.exec('uglifyJs', [file.path, newText, true])).code;
               } catch (error) {
                  changesStore.markFileAsFailed(file.history[0]);
                  logger.error({
                     message: 'Ошибка минификации скомпилированного TMPL',
                     error,
                     moduleInfo,
                     filePath: relativeFilePath.replace('.tmpl', '.min.tmpl')
                  });
               }
            }
         } catch (error) {
            changesStore.markFileAsFailed(file.history[0]);
            logger.error({
               message: 'Ошибка компиляции TMPL',
               error,
               moduleInfo,
               filePath: relativeFilePath
            });
         }

         if (outputMinFile) {
            this.push(
               new Vinyl({
                  base: moduleInfo.output,
                  path: outputMinFile,
                  contents: Buffer.from(newText),
                  history: [...file.history]
               })
            );
            changesStore.addOutputFile(file.history[0], outputMinFile);
         } else {
            file.contents = Buffer.from(newText);
         }
      } catch (error) {
         changesStore.markFileAsFailed(file.history[0]);
         logger.error({
            message: 'Ошибка builder\'а при компиляции TMPL',
            error,
            moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
