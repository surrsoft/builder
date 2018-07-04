/**
 * Плагин для компиляции ECMAScript 6+ и TypeScript в JavaScript (ES5).
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   fs = require('fs-extra'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate'),
   execInPool = require('../../common/exec-in-pool');

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
            if (!file.contents) {
               callback();
               return;
            }

            if (!['.es', '.ts'].includes(file.extname)) {
               callback(null, file);
               return;
            }
            if (file.path.endsWith('.d.ts')) {
               callback();
               return;
            }

            const relativePath = path.relative(moduleInfo.path, file.history[0]).replace(/\.(es|ts)$/, '.js');
            const outputPath = path.join(moduleInfo.output, transliterate(relativePath));

            if (file.cached) {
               changesStore.addOutputFile(file.history[0], outputPath, moduleInfo);
               callback(null, file);
               return;
            }

            const jsInSources = file.history[0].replace(/\.(es|ts)$/, '.js');
            if (await fs.pathExists(jsInSources)) {
               changesStore.markFileAsFailed(file.history[0]);
               const message =
                  `Существующий JS-файл мешает записи результата компиляции '${file.path}'. ` +
                  'Необходимо удалить лишний JS-файл';

               // выводим пока в режиме debug, чтобы никого не сподвигнуть удалять файлы пока
               logger.debug({
                  message,
                  filePath: jsInSources,
                  moduleInfo
               });
               callback(null, file);
               return;
            }

            // выводим пока в режиме debug, чтобы никого не сподвигнуть удалять файлы пока
            logger.debug({
               message: 'Компилируем в ES5',
               filePath: file.history[0],
               moduleInfo
            });

            let relativeFilePath = path.relative(moduleInfo.path, file.history[0]);
            relativeFilePath = path.join(path.basename(moduleInfo.path), relativeFilePath);

            const [error, result] = await execInPool(
               pool,
               'compileEsAndTs',
               [relativeFilePath, file.contents.toString()],
               file.history[0],
               moduleInfo
            );
            if (error) {
               changesStore.markFileAsFailed(file.history[0]);
               logger.error({
                  error,
                  filePath: file.history[0],
                  moduleInfo
               });
               callback(null, file);
               return;
            }

            changesStore.addOutputFile(file.history[0], outputPath, moduleInfo);
            const newFile = file.clone();
            newFile.contents = Buffer.from(result);
            newFile.path = outputPath;
            newFile.base = moduleInfo.output;
            this.push(newFile);
         } catch (error) {
            changesStore.markFileAsFailed(file.history[0]);
            logger.error({
               message: "Ошибка builder'а при компиляции в JS",
               error,
               moduleInfo,
               filePath: file.history[0]
            });
         }
         callback(null, file);
      }
   );
};
