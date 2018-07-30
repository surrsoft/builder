/**
 * Плагин для компиляции less.
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   fs = require('fs-extra'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate'),
   execInPool = require('../../common/exec-in-pool');

/**
 * Объявление плагина
 * @param {TaskParameters} taskParameters параметры для задач
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {string} sbis3ControlsPath путь до модуля SBIS3.CONTROLS. нужно для поиска тем
 * @param {string[]} pathsForImport пути, в которыи less будет искать импорты. нужно для работы межмодульных импортов.
 * @returns {stream}
 */
module.exports = function declarePlugin(taskParameters, moduleInfo, sbis3ControlsPath, pathsForImport) {
   return through.obj(

      /* @this Stream */
      async function onTransform(file, encoding, callback) {
         try {
            if (!file.path.endsWith('.less')) {
               callback(null, file);
               return;
            }

            const allThemes = {};
            const allOutputPath = {};
            changesStore.currentStore.styleThemes.forEach((value, key) => {
               allThemes[key] = value;

               const relativePath = path.relative(moduleInfo.path, file.history[0])
                  .replace(/\.less$/, `_${key}.css`);
               const outputPath = path.join(moduleInfo.output, transliterate(relativePath));
               allOutputPath[key] = outputPath;
            });

            if (file.cached) {
               Object.keys(allOutputPath).forEach((key) => {
                  taskParameters.cache..addOutputFile(file.history[0], allOutputPath[key], moduleInfo);
               });
               callback(null, file);
               return;
            }

            const cssInSources = file.history[0].replace(/\.less$/, '.css');
            if (await fs.pathExists(cssInSources)) {
               taskParameters.cache.markFileAsFailed(file.history[0]);
               const message =
                  `Существующий CSS-файл мешает записи результата компиляции '${file.path}'. ` +
                  'Необходимо удалить лишний CSS-файл';
               logger.warning({
                  message,
                  filePath: cssInSources,
                  moduleInfo
               });
               callback(null, file);
               return;
            }

            const [error, results] = await execInPool(
               taskParameters.pool,
               'buildLess',
               [
                  file.history[0],
                  file.contents.toString(),
                  moduleInfo.path,
                  sbis3ControlsPath,
                  pathsForImport,
                  allThemes
               ],
               file.history[0],
               moduleInfo
            );
            if (error) {
               taskParameters.cache.markFileAsFailed(file.history[0]);
               logger.error({
                  error,
                  filePath: file.history[0],
                  moduleInfo
               });
               callback(null, file);
               return;
            }

            results.forEach((result) => {if (result.ignoreMessage) {
               logger.debug(result.ignoreMessage);
            } else {
               taskParameters.cache.addOutputFile(file.history[0], allOutputPath[result.nameTheme], moduleInfo);
               taskParameters.cache.addDependencies(file.history[0], result.imports);
               const newFile = file.clone();
                     newFile.path= allOutputPath[result.nameTheme];
                     newFile.contents= Buffer.from(result.text);
                     this.push(newFile);
               }
            });
         } catch (error) {
            taskParameters.cache.markFileAsFailed(file.history[0]);
            logger.error({
               message: "Ошибка builder'а при компиляции less",
               error,
               moduleInfo,
               filePath: file.history[0]
            });
         }
         callback(null, file);
      }
   );
};
