/**
 * Плагин для создания contents.json и contents.js (информация для require, описание локализации и т.д.)
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   helpers = require('../../../lib/helpers');

/**
 * Объявление плагина
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {*}
 */
module.exports = function declarePlugin(config, moduleInfo) {
   return through.obj(
      function onTransform(file, encoding, callback) {
         callback(null, file);
      },

      /* @this Stream */
      function onFlush(callback) {
         try {
            // подготовим contents.json и contents.js
            if (config.version) {
               moduleInfo.contents.buildnumber = config.version;
            }

            // неведомой силы костыль для поддержания обратной совместимости в 3.18.410.
            // по ошибке:
            // https://online.sbis.ru/opendoc.html?guid=d34df2f8-cb22-42b0-919d-c0a27f7eb6dc
            const deprecateDictionary = {};
            const deprecatedModules = {};

            for (const modFolder of Object.keys(moduleInfo.contents.modules)) {
               if (moduleInfo.contents.modules[modFolder].hasOwnProperty('name')) {
                  deprecatedModules[moduleInfo.contents.modules[modFolder].name] = modFolder;
               } else {
                  deprecatedModules[modFolder] = modFolder;
               }

               if (moduleInfo.contents.modules[modFolder].hasOwnProperty('dict')) {
                  for (const dict of moduleInfo.contents.modules[modFolder].dict) {
                     if (dict.endsWith('.css')) {
                        deprecateDictionary[`${modFolder}.${dict}`] = true;
                     } else {
                        deprecateDictionary[`${modFolder}.${dict}.json`] = true;
                     }
                  }
               }
            }

            const deprecatedContents = {
               availableLanguage: moduleInfo.contents.availableLanguage,
               buildMode: moduleInfo.contents.buildMode,
               buildnumber: moduleInfo.contents.buildnumber,
               defaultLanguage: moduleInfo.contents.defaultLanguage,
               dictionary: deprecateDictionary,
               htmlNames: moduleInfo.contents.htmlNames,
               jsModules: {},
               modules: deprecatedModules,
               requirejsPaths: {},
               xmlContents: {}
            };
            const contentsJsFile = new Vinyl({
               path: 'contents.js',
               contents: Buffer.from(`contents=${JSON.stringify(helpers.sortObject(deprecatedContents))}`),
               moduleInfo
            });
            const contentsJsonFile = new Vinyl({
               path: 'contents.json',
               contents: Buffer.from(JSON.stringify(helpers.sortObject(deprecatedContents), null, 2)),
               moduleInfo
            });

            this.push(contentsJsFile);
            this.push(contentsJsonFile);
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
