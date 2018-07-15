/**
 * Плагин для версионирования после инкрементальной сборки. Меняет заглушку на нормальную версию.
 * Связан с versionize-to-stub
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   logger = require('../../../lib/logger').logger();

const VERSION_STUB = /\.vBUILDER_VERSION_STUB/g;

const includeExts = ['.css', '.js', '.html', '.tmpl', '.xhtml'];

/**
 *
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {*}
 */
module.exports = function declarePlugin(config, moduleInfo) {
   return through.obj(function onTransform(file, encoding, callback) {
      try {
         if (!includeExts.includes(file.extname)) {
            callback(null, file);
            return;
         }

         let version = '';

         /**
          * временно версионируем дебажные cssки. Нужно для нормальной работы шрифтов в IE.
          * TODO выпилить, когда будет решение по задаче
          * https://online.sbis.ru/opendoc.html?guid=bcd44398-026d-4717-9c0e-c8f3affd6795
          */
         if (file.path.match(/\.min\.[^.\\/]+$/) || ['.css', '.html'].includes(file.extname)) {
            version = `.v${config.version}`;
         }
         const text = file.contents.toString();
         file.contents = Buffer.from(text.replace(VERSION_STUB, version));
      } catch (error) {
         logger.error({
            message: "Ошибка builder'а при версионировании",
            error,
            moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
