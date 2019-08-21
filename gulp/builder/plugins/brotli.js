/**
 * Gulp plugin for files compress to brotli.
 * @author Kolbeshin F.A.
 */

'use strict';

const through = require('through2'),
   logger = require('../../../lib/logger').logger(),
   helpers = require('../../../lib/helpers'),
   { promiseWithTimeout } = require('../../../lib/promise-with-timeout');

const includeExts = ['.js', '.json', '.css', '.tmpl', '.woff', '.ttf', '.eot'];

const excludeRegexes = [
   /.*\.routes\.js$/,
   /.*\.test\.js$/,
   /[/\\]ServerEvent[/\\]worker[/\\].*/,
   /.*\.routes\.js$/,
   /.*\.original\.js$/,
   /.*\.modulepack\.js$/,
   /.*\.test\.js$/,
   /.*\.esp\.json$/,
   /.*[/\\]data-providers[/\\].*\.js$/,
   /.*[/\\]design[/\\].*\.js$/
];

/**
 * Объявление плагина
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {stream}
 */
module.exports = function declarePlugin(moduleInfo) {
   return through.obj(

      /* @this Stream */
      async function onTransform(file, encoding, callback) {
         try {
            if (!file.contents) {
               callback();
               return;
            }

            if (file.extname === '.gz') {
               callback(null, file);
               return;
            }
            if (!includeExts.includes(file.extname)) {
               callback();
               return;
            }

            for (const regex of excludeRegexes) {
               if (regex.test(file.path)) {
                  callback();
                  return;
               }
            }

            const brotliContent = await promiseWithTimeout(helpers.brotli(file.contents), 90000);
            file.path = `${file.path}.br`;
            file.contents = Buffer.from(brotliContent);
            this.push(file);
         } catch (error) {
            logger.error({
               message: "Ошибка builder'а при архивации",
               error,
               moduleInfo,
               filePath: file.path
            });
         }
         callback();
      }
   );
};
