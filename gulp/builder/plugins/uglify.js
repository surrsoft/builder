/* eslint-disable no-invalid-this */
'use strict';

const through = require('through2'),
   path = require('path'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

const includeExts = ['.js', '.jstpl', '.json'];

const excludeRegexes = [
   /.*\.min\.js$/,
   /.*\.routes\.js$/,
   /.*\.test\.js$/,
   /.*\.package\.json$/,
   /\/node_modules\/.*/,
   /\/ServerEvent\/worker\/.*/,

   //https://online.sbis.ru/opendoc.html?guid=761eb095-c7be-437d-ab0c-c5058de852a4
   /\/EDO2\/Route\/.*/
];

module.exports = function(changesStore, moduleInfo, pool) {
   return through.obj(async function(file, encoding, callback) {
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
            .replace(file.extname, '.min' + file.extname);
         const outputMinFile = path.join(moduleInfo.output, transliterate(relativePath));

         if (file.cached) {
            changesStore.addOutputFile(file.history[0], outputMinFile);
            callback(null, file);
            return;
         }

         //если файл не возможно минифицировать, то запишем оригинал
         let newText = file.contents.toString();
         try {
            if (file.extname === '.json') {
               newText = JSON.stringify(JSON.parse(newText));
            } else if (file.extname === '.js') {
               const minMapPath = outputMinFile + '.map';
               const sourceMapUrl = path.basename(minMapPath);
               const minified = await pool.exec('uglifyJs', [file.path, newText, false, sourceMapUrl]);
               newText = minified.code;
               if (minified.hasOwnProperty('map') && minified.map) {
                  this.push(
                     new Vinyl({
                        base: moduleInfo.output,
                        path: minMapPath,
                        contents: Buffer.from(minified.map)
                     })
                  );
               }
            }

            /**
             * jstpl копируем напрямую, их минифицировать никак нельзя,
             * но .min файл присутствовать должен во избежание 404х
             */
         } catch (error) {
            changesStore.markFileAsFailed(file.history[0]);
            logger.error({
               message: 'Ошибка минификации файла',
               error: error,
               moduleInfo: moduleInfo,
               filePath: file.path
            });
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
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
