/**
 * Плагин для минификации css
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),

   // Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate'),
   execInPool = require('../../common/exec-in-pool');

const excludeRegexes = [/.*\.min\.css$/, /[/\\]node_modules[/\\].*/, /[/\\]design[/\\].*/, /[/\\]service[/\\].*/];

/**
 * Объявление плагина
 * @param {TaskParameters} taskParameters параметры для задач
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {stream}
 */
module.exports = function declarePlugin(taskParameters, moduleInfo) {
   return through.obj(

      /* @this Stream */
      async function onTransform(file, encoding, callback) {
         try {
            // Нужно вызвать taskParameters.cache.addOutputFile для less, чтобы не удалился *.min.css файл.
            // Ведь самой css не будет в потоке при повторном запуске
            if (!['.css', '.less'].includes(file.extname)) {
               callback(null, file);
               return;
            }

            for (const regex of excludeRegexes) {
               if (regex.test(file.path)) {
                  callback(null, file);
                  return;
               }
            }

            const lastHistory = file.history[file.history.length - 1];
            const relativePath = path.relative(
               /\.css$/.test(file.history[0]) ? moduleInfo.path : moduleInfo.output,
               lastHistory
            ).replace(/\.css$/, '.min.css');
            const outputMinFile = path.join(moduleInfo.output, transliterate(relativePath));
            if (file.cached) {
               taskParameters.cache.getOutputFile(file.history[0]).forEach((outputFile) => {
                  taskParameters.cache.addOutputFile(file.history[0], outputFile.replace(/\.css$/, '.min.css'), moduleInfo);
               });
               callback(null, file);
               return;
            }

            // Минифицировать less не нужно
            if (file.extname !== '.css') {
               callback(null, file);
               return;
            }

            // если файл не возможно минифицировать, то запишем оригинал
            let newText = file.contents.toString();

            const [error, minified] = await execInPool(taskParameters.pool, 'minifyCss', [newText]);
            newText = minified.styles;
            if (minified.errors.length > 0) {
               taskParameters.cache.markFileAsFailed(file.history[0]);
               const errors = minified.errors.toString();
               logger.warning({
                  message: `Ошибки минификации файла: ${errors.split('; ')}`,
                  moduleInfo,
                  filePath: file.path
               });
            }
            if (error) {
               taskParameters.cache.markFileAsFailed(file.history[0]);
               logger.error({
                  message: 'Ошибка минификации файла',
                  error,
                  moduleInfo,
                  filePath: file.path
               });
            }

            const newFile = file.clone();
            newFile.contents = Buffer.from(newText);
            newFile.path = outputMinFile;
            newFile.base = moduleInfo.output;
            this.push(newFile);
            taskParameters.cache.addOutputFile(file.history[0], outputMinFile, moduleInfo);
         } catch (error) {
            taskParameters.cache.markFileAsFailed(file.history[0]);
            logger.error({
               message: "Ошибка builder'а при минификации",
               error,
               moduleInfo,
               filePath: file.path
            });
         }
         callback(null, file);
      }
   );
};
