/* eslint-disable no-invalid-this */
'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   DictionaryIndexer = require('../../../lib/i18n/dictionary-indexer');

// если есть ресурсы локализации, то нужно записать <локаль>.js файл в папку "lang/<локаль>" и занести данные в contents.json
// + css локализации нужно объединить
module.exports = function(config, moduleInfo) {
   const indexer = new DictionaryIndexer(config.localizations);
   return through.obj(
      (file, encoding, callback) => {
         try {
            // нам нужны только css и json локализации
            const locale = file.stem;
            if (file.extname !== '.json' && file.extname !== '.css' || !config.localizations.includes(locale)) {
               callback(null, file);
               return;
            }
            if (file.extname === '.json') {
               indexer.addLocalizationJson(moduleInfo.output, file.path, locale);
            } else if (file.extname === '.css') {
               indexer.addLocalizationCSS(moduleInfo.output, file.path, locale, file.contents.toString());
            }
         } catch (error) {
            logger.error({
               message: "Ошибка Builder'а",
               error,
               moduleInfo,
               filePath: file.path
            });
         }
         callback(null, file);
      },
      function(callback) {
         try {
            for (const locale of config.localizations) {
               const mergedCSSCode = indexer.extractMergedCSSCode(moduleInfo.output, locale);
               if (mergedCSSCode) {
                  const mergedCSSPath = path.join(moduleInfo.output, 'lang', locale, `${locale}.css`);
                  this.push(
                     new Vinyl({
                        base: moduleInfo.output,
                        path: mergedCSSPath,
                        contents: Buffer.from(mergedCSSCode)
                     })
                  );
               }

               const loaderCode = indexer.extractLoaderCode(moduleInfo.output, locale);
               if (loaderCode) {
                  const loaderPath = path.join(moduleInfo.output, 'lang', locale, `${locale}.js`);
                  this.push(
                     new Vinyl({
                        base: moduleInfo.output,
                        path: loaderPath,
                        contents: Buffer.from(loaderCode)
                     })
                  );
               }
            }
            moduleInfo.contents.dictionary = indexer.getDictionaryForContents();
         } catch (error) {
            logger.error({
               message: "Ошибка Builder'а",
               error,
               moduleInfo
            });
         }
         callback();
      }
   );
};
