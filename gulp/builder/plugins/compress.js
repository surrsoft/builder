/**
 * Builder plugin for compressing of files using both of gzip and brotli algorithms
 * Pushes into file stream nothing but compressed versions of minified files to be written into output directory
 * to avoid unnecessary files rewriting
 * @author Kolbeshin F.A.
 */

'use strict';

const through = require('through2'),
   logger = require('../../../lib/logger').logger(),
   helpers = require('../../../lib/helpers'),
   path = require('path'),
   execInPool = require('../../common/exec-in-pool');

const excludeRegexes = [
   /[/\\]ServerEvent[/\\]worker[/\\].*/,
   /.*[/\\]data-providers[/\\].*\.js$/,
   /.*[/\\]design[/\\].*\.js$/
];

/**
 * Объявление плагина
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {stream}
 */
module.exports = function declarePlugin(taskParameters, moduleInfo) {
   return through.obj(

      /* @this Stream */
      async function onTransform(file, encoding, callback) {
         try {
            if (!file.contents) {
               callback();
               return;
            }

            for (const regex of excludeRegexes) {
               if (regex.test(file.path)) {
                  callback();
                  return;
               }
            }

            const prettyOutputPath = helpers.unixifyPath(
               path.join(
                  moduleInfo.output,
                  file.relative
               )
            );

            // if input minified file has already been cached, it already has an archived version of itself.
            if (taskParameters.cache.isCachedMinified(prettyOutputPath)) {
               callback();
               return;
            }

            const [error, result] = await execInPool(
               taskParameters.pool,
               'compress',
               [file.contents.toString()],
               file.path,
               moduleInfo
            );
            if (error) {
               logger.error({
                  message: 'Error occurred while compressing',
                  error,
                  moduleInfo,
                  filePath: file.path
               });
            } else {
               const newFile = file.clone();
               newFile.path = `${file.path}.gz`;
               newFile.contents = Buffer.from(result.gzip);
               this.push(newFile);
               file.path = `${file.path}.br`;
               file.contents = Buffer.from(result.brotli);
               this.push(file);
            }
         } catch (error) {
            logger.error({
               message: "Builder's error occurred in 'compress' task",
               error,
               moduleInfo,
               filePath: file.path
            });
         }
         callback();
      }
   );
};
