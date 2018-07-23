/**
 * Плагин для компиляции ECMAScript 6+ и TypeScript в JavaScript (ES5).
 * Без учёта инкрементальной сборки. Нужно для подготовки WS для исполнения в билдере.
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   execInPool = require('../../common/exec-in-pool');

/**
 * Объявление плагина
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {Pool} pool пул воркеров
 * @returns {stream}
 */
module.exports = function declarePlugin(moduleInfo, pool) {
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
               logger.error({
                  error,
                  filePath: file.history[0],
                  moduleInfo
               });
               callback(null, file);
               return;
            }

            const newFile = file.clone();
            newFile.contents = Buffer.from(result);
            newFile.path = file.path.replace(/\.(es|ts)$/, '');
            this.push(newFile);
         } catch (error) {
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
