/**
 * Плагин для компиляции xml из *.xhtml файлов в js для release режима.
 * Создаёт новый файл *.min.xhtml.
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate'),
   execInPool = require('../../helpers/exec-in-pool');

/**
 * Объявление плагина
 * @param {ChangesStore} changesStore кеш
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {Pool} pool пул воркеров
 * @returns {*}
 */
module.exports = function declarePlugin(changesStore, moduleInfo, pool) {
   return through.obj(

      /* @this Stream */
      async function onTransform(file, encoding, callback) {
         try {
            if (file.extname !== '.xhtml') {
               callback(null, file);
               return;
            }
            const relativePath = path.relative(moduleInfo.path, file.history[0]).replace(/\.xhtml/, '.min.xhtml');
            const outputMinFile = path.join(moduleInfo.output, transliterate(relativePath));

            if (file.cached) {
               changesStore.addOutputFile(file.history[0], outputMinFile, moduleInfo);
               callback(null, file);
               return;
            }

            // если xhtml не возможно скомпилировать, то запишем оригинал
            let newText = file.contents.toString();
            let relativeFilePath = path.relative(moduleInfo.path, file.history[0]);
            relativeFilePath = path.join(path.basename(moduleInfo.path), relativeFilePath);

            const [errorBuild, resultBuild] = await execInPool(
               pool,
               'buildXhtml',
               [newText, relativeFilePath],
               relativeFilePath,
               moduleInfo
            );
            if (errorBuild) {
               changesStore.markFileAsFailed(file.history[0]);
               logger.error({
                  message: 'Ошибка компиляции XHTML',
                  errorBuild,
                  moduleInfo,
                  filePath: relativeFilePath
               });
            } else {
               changesStore.storeBuildedMarkup(file.history[0], moduleInfo.name, resultBuild);
               newText = resultBuild.text;

               // если xhtml не возможно минифицировать, то запишем оригинал

               const [error, obj] = await execInPool(pool, 'uglifyJs', [file.path, newText, true]);
               newText = obj.code;
               if (error) {
                  changesStore.markFileAsFailed(file.history[0]);
                  logger.error({
                     message: 'Ошибка минификации скомпилированного XHTML',
                     error,
                     moduleInfo,
                     filePath: relativeFilePath.replace('.xhtml', '.min.xhtml')
                  });
               }
            }

            this.push(
               new Vinyl({
                  base: moduleInfo.output,
                  path: outputMinFile,
                  contents: Buffer.from(newText),
                  history: [...file.history]
               })
            );
            changesStore.addOutputFile(file.history[0], outputMinFile, moduleInfo);
         } catch (error) {
            changesStore.markFileAsFailed(file.history[0]);
            logger.error({
               message: "Ошибка builder'а при компиляции XHTML",
               error,
               moduleInfo,
               filePath: file.path
            });
         }
         callback(null, file);
      }
   );
};
