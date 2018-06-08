/* eslint-disable no-invalid-this */
'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate'),
   execInPool = require('../../helpers/exec-in-pool');

module.exports = function declarePlugin(config, changesStore, moduleInfo, pool) {
   const componentsPropertiesFilePath = path.join(config.cachePath, 'components-properties.json');

   return through.obj(async function onTransform(file, encoding, callback) {
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

         const [error, result] = await execInPool(
            pool,
            'buildTmpl',
            [newText, relativeFilePath, componentsPropertiesFilePath],
            relativeFilePath,
            moduleInfo
         );
         if (error) {
            changesStore.markFileAsFailed(file.history[0]);
            logger.error({
               message: 'Ошибка компиляции TMPL',
               error,
               moduleInfo,
               filePath: relativeFilePath
            });
         } else {
            changesStore.storeBuildedMarkup(file.history[0], moduleInfo.name, result);
            newText = result.text;

            if (config.isReleaseMode) {
               // если tmpl не возможно минифицировать, то запишем оригинал

               const [errorUglify, obj] = await execInPool(
                  pool,
                  'uglifyJs',
                  [file.path, newText, true],
                  relativeFilePath.replace('.tmpl', '.min.tmpl'),
                  moduleInfo
               );
               if (errorUglify) {
                  changesStore.markFileAsFailed(file.history[0]);
                  logger.error({
                     message: 'Ошибка минификации скомпилированного TMPL',
                     errorUglify,
                     moduleInfo,
                     filePath: relativeFilePath.replace('.tmpl', '.min.tmpl')
                  });
               } else {
                  newText = obj.code;
               }
            }
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
            message: "Ошибка builder'а при компиляции TMPL",
            error,
            moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
