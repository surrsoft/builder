/**
 * Плагин для кастомной паковки. Ищет файлы *.package.json, в зависимости от наличия опции level и её значения
 * делит конфигурации для кастомной паковки на приоритетные и обычные.
 * @author Колбешин Ф.А.
 */

'use strict';

const
   path = require('path'),
   through = require('through2'),
   packHelpers = require('../../../lib/pack/helpers/custompack'),
   helpers = require('../../../lib/helpers'),
   logger = require('../../../lib/logger').logger();

/**
 * Объявление плагина
 * @param {Object} configs все конфигурации для кастомной паковки
 * @param {string} root корень развернутого приложения
 * @returns {stream}
 */
module.exports = function collectPackageJson(taskParameters, moduleInfo, root) {
   const
      allConfigs = {},
      superBundles = [];
   return through.obj(
      function onTransform(file, encoding, callback) {
         let currentPackageJson;
         try {
            currentPackageJson = JSON.parse(file.contents);
            const test = path.relative(path.dirname(moduleInfo.path), file.path);
            const configsArray = packHelpers.getConfigsFromPackageJson(
               test,
               currentPackageJson
            );
            configsArray.forEach((currentConfig) => {
               taskParameters.config.customPackages.push(currentConfig);
            });
         } catch (err) {
            logger.error({
               message: 'Ошибка парсинга конфигурации для кастомного пакета',
               filePath: file.path
            });
         }
         callback();
      },
      function onFlush(callback) {
         callback();
      }
   );
};
