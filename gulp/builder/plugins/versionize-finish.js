/**
 * Плагин для версионирования после инкрементальной сборки. Меняет заглушку на нормальную версию.
 * Связан с versionize-to-stub
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   logger = require('../../../lib/logger').logger();

const VERSION_STUB = /\.vBUILDER_VERSION_STUB/g;
const VERSION_MIN_STUB = /\.vBUILDER_VERSION_MIN_STUB/g;

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
         let versionMin = '';

         if (file.path.match(/\.min\.[^.\\/]+$/) || file.extname === '.html') {
            version = `.v${config.version}`;
            versionMin = `.min.v${config.version}`;
         }
         const text = file.contents.toString();
         file.contents = Buffer.from(text.replace(VERSION_STUB, version).replace(VERSION_MIN_STUB, versionMin));
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
