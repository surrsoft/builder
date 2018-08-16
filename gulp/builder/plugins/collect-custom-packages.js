/**
 * Плагин для кастомной паковки. Ищет файлы *.package.json, в зависимости от наличия опции level и её значения
 * делит конфигурации для кастомной паковки на приоритетные и обычные.
 * @author Колбешин Ф.А.
 */

'use strict';

const path = require('path'),
   through = require('through2'),
   packHelpers = require('../../../lib/pack/helpers/custompack'),
   logger = require('../../../lib/logger').logger();

/**
 * Объявление плагина
 * @param {Object} configs все конфигурации для кастомной паковки
 * @param {string} root корень развернутого приложения
 * @returns {stream}
 */
module.exports = function collectPackageJson(configs, root) {
   return through.obj(function onTransform(file, encoding, callback) {
      let currentPackageJson;
      try {
         currentPackageJson = JSON.parse(file.contents);
         const configsArray = packHelpers.getConfigsFromPackageJson(
            file.path.replace(path.normalize(`${root}/`), ''),
            root,
            currentPackageJson
         );
         configsArray.forEach((currentConfig) => {
            switch (currentConfig.level) {
               case 'Service':
                  configs.priorityConfigs.push(currentConfig);
                  break;
               case 'Module':
               default:
                  configs.normalConfigs.push(currentConfig);
                  break;
            }
         });
      } catch (err) {
         logger.error({
            message: 'Ошибка парсинга конфигурации для кастомного пакета',
            filePath: file.path
         });
      }
      callback();
   });
};
