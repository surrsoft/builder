/* eslint-disable no-invalid-this */
'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   DictionaryIndexer = require('../../../lib/i18n/dictionary-indexer');


//если есть ресурсы локализации, то нужно записать <локаль>.js файл в папку "lang/<локаль>" и занести данные в contents.json
// + css локализации нужно объединить
module.exports = function(moduleInfo, config) {
   const indexer = new DictionaryIndexer(config.localizations);
   return through.obj(function(file, encoding, callback) {
      try {
         this.push(file);

         //нам нужны только css и json локализации
         const locale = file.stem;
         if (file.extname !== '.json' && file.extname !== '.css' || !config.localizations.includes(locale)) {
            callback();
            return;
         }
         if (file.extname === '.json') {
            indexer.addLocalizationJson(moduleInfo.output, file.path, locale);
         } else if (file.extname === '.css') {
            indexer.addLocalizationCSS(moduleInfo.output, file.path, locale, file.contents.toString());
         }
      } catch (error) {
         logger.error({
            message: 'Ошибка Builder\'а',
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.path
         });
      }
      callback();
   }, function(callback) {
      try {
         for (const localization of config.localizations) {
            const mergedCSSCode = indexer.extractMergedCSSCode(moduleInfo.output, localization);
            if (mergedCSSCode) {
               const mergedCSSPath = path.join(moduleInfo.output, 'lang', localization, localization + '.css');
               this.push(new Vinyl({
                  base: moduleInfo.output,
                  path: mergedCSSPath,
                  contents: Buffer.from(mergedCSSCode)
               }));
            }

            const loaderCode = indexer.extractLoaderCode(moduleInfo.output, localization);
            if (loaderCode) {
               const loaderPath = path.join(moduleInfo.output, 'lang', localization, localization + '.js');
               this.push(new Vinyl({
                  base: moduleInfo.output,
                  path: loaderPath,
                  contents: Buffer.from(loaderCode)
               }));
            }
         }
         const dictionary = indexer.getDictionaryForContents();
         if (Object.keys(dictionary).length > 0) {
            moduleInfo.contents.dictionary = dictionary;
         }
      } catch (error) {
         logger.error({
            message: 'Ошибка Builder\'а',
            error: error,
            moduleInfo: moduleInfo
         });
      }
      callback();
   });
};
