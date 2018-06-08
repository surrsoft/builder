'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

const includeExts = ['.jstpl', '.json'];

const excludeRegexes = [/.*\.package\.json$/, /[/\\]node_modules[/\\].*/];

module.exports = function declarePlugin(changesStore, moduleInfo) {
   return through.obj(

      /** @this Stream */
      function onTransform(file, encoding, callback) {
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

            const relativePath = path
               .relative(moduleInfo.path, file.history[0])
               .replace(file.extname, `.min${file.extname}`);
            const outputMinFile = path.join(moduleInfo.output, transliterate(relativePath));

            if (file.cached) {
               changesStore.addOutputFile(file.history[0], outputMinFile);
               callback(null, file);
               return;
            }

            /**
             * если json файл не возможно минифицировать, то запишем оригинал.
             * jstpl копируем напрямую, их минифицировать никак нельзя,
             * но .min файл присутствовать должен во избежание ошибки 404
             */
            let newText = file.contents.toString();

            if (file.extname === '.json') {
               try {
                  newText = JSON.stringify(JSON.parse(newText));
               } catch (error) {
                  changesStore.markFileAsFailed(file.history[0]);
                  logger.error({
                     message: 'Ошибка минификации файла',
                     error,
                     moduleInfo,
                     filePath: file.path
                  });
               }
            }

            this.push(
               new Vinyl({
                  base: moduleInfo.output,
                  path: outputMinFile,
                  contents: Buffer.from(newText)
               })
            );
            changesStore.addOutputFile(file.history[0], outputMinFile);
         } catch (error) {
            changesStore.markFileAsFailed(file.history[0]);
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
