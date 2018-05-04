/* eslint-disable no-invalid-this */
'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

module.exports = function(config, changesStore, moduleInfo, pool) {
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

         const componentsPropertiesFilePath = path.join(config.cachePath, 'components-properties.json');

         //если tmpl не возможно скомпилировать, то запишем оригинал
         let newText = file.contents.toString();
         try {
            let relativeFilePath = path.relative(moduleInfo.path, file.history[0]);
            relativeFilePath = path.join(path.basename(moduleInfo.path), relativeFilePath);

            newText = await pool.exec('buildTmpl', [newText, relativeFilePath, componentsPropertiesFilePath]);
         } catch (error) {
            logger.warning({
               message: 'Ошибка компиляции TMPL',
               error: error,
               moduleInfo: moduleInfo,
               filePath: file.path
            });
         }

         if (outputMinFile) {
            this.push(
               new Vinyl({
                  base: moduleInfo.output,
                  path: outputMinFile,
                  contents: Buffer.from(newText)
               })
            );
            changesStore.addOutputFile(file.history[0], outputMinFile);
         } else {
            file.contents = Buffer.from(newText);
         }
      } catch (error) {
         logger.error({
            message: "Ошибка builder'а при компиляции TMPL",
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
