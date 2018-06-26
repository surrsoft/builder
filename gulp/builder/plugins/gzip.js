/**
 * Плагин архивации файлов с помощью gzip
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   execInPool = require('../../common/exec-in-pool');

const includeExts = ['.js', '.json', '.css', '.tmpl', '.woff', '.ttf', '.eot'];

const excludeRegexes = [
   /.*\.routes\.js$/,
   /.*\.test\.js$/,
   /[/\\]node_modules[/\\].*/,
   /[/\\]ServerEvent[/\\]worker[/\\].*/,
   /.*\.routes\.js$/,
   /.*\.original\.js$/,
   /.*\.modulepack\.js$/,
   /.*\.test\.js$/,
   /.*\.esp\.json$/,
   /.*[/\\]data-providers[/\\].*\.js$/,
   /.*[/\\]design[/\\].*\.js$/,
   /.*[/\\]node_modules[/\\].*\.js$/
];

/**
 * Объявление плагина
 * @param {Pool} pool пул воркеров
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {*}
 */
module.exports = function declarePlugin(pool, moduleInfo = null) {
   return through.obj(

      /* @this Stream */
      async function onTransform(file, encoding, callback) {
         try {
            if (!includeExts.includes(file.extname)) {
               callback(null, file);
               return;
            }

            for (const regex of excludeRegexes) {
               if (regex.test(file.path)) {
                  callback(null, file);
                  return;
               }
            }

            /**
             * в gzip в качестве данных мы передаём именно буфер, а не строку,
             * поскольку toString портит шрифты и они становятся впоследствии при
             * разархивации нечитаемыми
             */
            const [error, gzipContent] = await execInPool(pool, 'gzip', [file.contents]);
            if (error) {
               logger.error({
                  message: "Ошибка builder'а при архивации",
                  error,
                  moduleInfo,
                  filePath: file.path
               });
            } else {
               this.push(
                  new Vinyl({
                     base: file.base,
                     path: `${file.path}.gz`,
                     contents: Buffer.from(gzipContent),
                     history: [...file.history]
                  })
               );
            }
         } catch (error) {
            logger.error({
               message: "Ошибка builder'а при архивации",
               error,
               moduleInfo,
               filePath: file.path
            });
         }
         callback(null, file);
      }
   );
};
