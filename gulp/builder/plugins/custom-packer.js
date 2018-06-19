/**
 * Плагин для кастомной паковки. Ищет файлы *.package.json, формирует пакеты согласно опциям в этих json.
 * @author Колбешин Ф.А.
 */

'use strict';

const path = require('path'),
   through = require('through2'),
   packHelpers = require('../../../lib/pack/helpers/custompack'),
   customPacker = require('../../../lib/pack/custom-packer'),
   logger = require('../../../lib/logger').logger();

/**
 * Объявление плагина
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {DependencyGraph} depsTree граф зависимостей
 * @param {{bundles:{}, bundlesRoute:{}}} results результаты паковки для конкретного конфига
 * @param {string} root корень развернутого приложения
 * @returns {*}
 */
module.exports = function generatePackageJson(config, depsTree, results, root) {
   return through.obj(async function onTransform(file, encoding, callback) {
      let currentConfig;
      try {
         currentConfig = JSON.parse(file.contents);
      } catch (err) {
         logger.error({
            message: 'Ошибка парсинга конфигурации для кастомного пакета',
            filePath: file.path
         });
      }
      const configsArray = packHelpers.getConfigsFromPackageJson(
         file.path.replace(path.normalize(`${root}/`), ''),
         root,
         currentConfig
      );
      const currentResult = await customPacker.generatePackageJsonConfigs(
         depsTree,
         configsArray,
         root,

         // application
         '/',

         // splittedCore
         true,

         // isGulp
         true,
         config.localizations
      );

      packHelpers.appendBundlesOptionsToCommon(currentResult, results, 'bundles');
      packHelpers.appendBundlesOptionsToCommon(currentResult, results, 'bundlesRoute');
      callback();
   });
};
