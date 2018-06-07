'use strict';

const path = require('path'),
   through = require('through2'),
   packHelpers = require('../../../lib/pack/helpers/custompack'),
   customPacker = require('../../../lib/pack/custom-packer'),
   logger = require('../../../lib/logger').logger();

module.exports = function generatePackageJson(config, depsTree, results, applicationRoot, splittedCore) {
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
         file.path.replace(path.normalize(`${applicationRoot}/`), ''),
         applicationRoot,
         currentConfig
      );
      const currentResult = await customPacker.generatePackageJsonConfigs(
         depsTree,
         configsArray,
         applicationRoot,
         splittedCore,
         true,
         config.localizations
      );

      packHelpers.appendBundlesOptionsToCommon(currentResult, results, 'bundles');
      packHelpers.appendBundlesOptionsToCommon(currentResult, results, 'bundlesRoute');
      callback();
   });
};
