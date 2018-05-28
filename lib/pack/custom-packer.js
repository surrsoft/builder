'use strict';

const
   commonPackage = require('../../packer/lib/commonPackage'),
   fs = require('fs-extra'),
   logger = require('../../lib/logger').logger(),
   packCSS = require('../../packer/tasks/lib/packCSS').promisedPackCSS,
   packerDictionary = require('../../packer/tasks/lib/packDictionary'),
   packHelpers = require('./helpers/custompack'),
   path = require('path'),
   pMap = require('p-map');

async function _writeCustomPackage(packageConfig, applicationRoot, application, buildNumber) {
   const
      currentFileExists = await fs.pathExists(packageConfig.outputFile),
      originalFileExists = await fs.pathExists(packHelpers.originalPath(packageConfig.outputFile));

   // Не будем портить оригинальный файл.
   if (currentFileExists && !originalFileExists) {
      await fs.copy(packageConfig.outputFile, packHelpers.originalPath(packageConfig.outputFile));
   }
   const result = await commonPackage.limitingNativePackFiles(packageConfig.orderQueue, applicationRoot);
   if (packageConfig.cssModulesFromOrderQueue.length > 0) {
      result.unshift(packHelpers.generateLinkForCss(packageConfig.cssModulesFromOrderQueue, application, packageConfig.packagePath, buildNumber));
   }

   if (packageConfig.optimized) {
      await fs.writeFile(packageConfig.outputFile, await packHelpers.generatePackageToWrite(result));
   } else {
      await fs.writeFile(packageConfig.outputFile, result ? result.reduce((res, modContent) => res + (res ? '\n' : '') + modContent) : '');
   }
}

async function _generateCustomPackage(depsTree, applicationRoot, packageConfig, bundlesOptions) {
   const
      isSplittedCore = bundlesOptions.splittedCore,
      outputFile = packHelpers.getOutputFile(packageConfig, applicationRoot, depsTree, isSplittedCore),
      packagePath = packHelpers.getBundlePath(outputFile, applicationRoot, isSplittedCore ? 'resources/WS.Core' : 'ws'),
      pathToCustomCSS = outputFile.replace(/\.js$/, '.css'),
      result = {
         bundles: {},
         bundlesRoute: {}
      };

   let
      cssModulesFromOrderQueue = [],
      orderQueue;

   if (packageConfig.isBadConfig) {
      throw new Error('Конфиг для кастомного пакета должен содержать опцию include для нового вида паковки.');
   }
   orderQueue = packHelpers.getOrderQueue(depsTree, packageConfig, applicationRoot)
      .filter(function(node) {
         if (node.plugin === 'js' || node.plugin === 'tmpl' || node.plugin === 'html') {
            return node.amd;
         }
         if (node.fullName.includes('css!')) {
            cssModulesFromOrderQueue.push(node);
            return false;
         }
         return true;
      });

   /**
    * пишем все стили по пути кастомного пакета в css-файл.
    */
   cssModulesFromOrderQueue = commonPackage.prepareResultQueue(cssModulesFromOrderQueue, applicationRoot);
   if (cssModulesFromOrderQueue.css.length > 0) {
      const cssRes = await packCSS(cssModulesFromOrderQueue.css.filter(function removeControls(module) {
         if (packageConfig.themeName) {
            return !module.fullName.startsWith('css!SBIS3.CONTROLS/') && !module.fullName.startsWith('css!Controls/');
         }
         return true;
      }).map(function onlyPath(module) {
         return module.fullPath;
      }), applicationRoot);
      await fs.outputFile(pathToCustomCSS, cssRes);
   }

   if (packageConfig.platformPackage || !packageConfig.includeCore) {
      result.bundles[packagePath] = await packHelpers.generateBundle(orderQueue, cssModulesFromOrderQueue.css, isSplittedCore);
      result.bundlesRoute = packHelpers.generateBundlesRouting(result.bundles[packagePath], packagePath);
   }

   orderQueue = packerDictionary.deleteModulesLocalization(orderQueue);
   packageConfig.orderQueue = await packerDictionary.packerCustomDictionary(orderQueue, applicationRoot);
   packageConfig.outputFile = outputFile;
   packageConfig.packagePath = packagePath;
   packageConfig.cssModulesFromOrderQueue = cssModulesFromOrderQueue.css;
   result.output = packageConfig.outputFile;

   await _writeCustomPackage(packageConfig, applicationRoot, bundlesOptions.application, bundlesOptions.buildNumber);
   return result;
}

/**
 * Функция, которая сплитит результат работы таски custompack в секции bundles
 */
async function _saveBundlesForEachModule(applicationRoot, result) {
   /**
    * Сделаем список json на запись, нам надо защититься от параллельной перезаписи
    */
   const jsonToWrite = {};
   await pMap(
      Object.keys(result.bundles),
      async currentBundle => {
         const
            bundlePath = path.normalize(path.join(applicationRoot, `${currentBundle.match(/^resources\/[^/]+/)}`, 'bundlesRoute.json')),
            currentModules = result.bundles[currentBundle];


         if (await fs.pathExists(bundlePath)) {
            jsonToWrite[bundlePath] = await fs.readJson(bundlePath);
         }

         if (!jsonToWrite[bundlePath]) {
            jsonToWrite[bundlePath] = {};
         }

         currentModules.forEach(function(node) {
            if (node.indexOf('css!') === -1) {
               jsonToWrite[bundlePath][node] = currentBundle;
            }
         });
      },
      {
         concurrency: 10
      }
   );
   await pMap(
      Object.keys(jsonToWrite),
      key => fs.writeJson(key, jsonToWrite[key]),
      {
         concurrency: 10
      }
   );
}

/**
 * Сохраняем результаты работы кастомной паковки для всех секций.
 */
async function _saveCustomPackResults(result, applicationRoot, splittedCore) {
   const
      bundlesPath = 'ext/requirejs',
      wsRoot = splittedCore ? 'resources/WS.Core' : 'ws',
      bundlesRoutePath = path.join(wsRoot, bundlesPath, 'bundlesRoute').replace(/\\/g, '/'),
      pathsToSave = {
         bundles: path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.js'),
         bundlesJson: path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.json'),
         bundlesRoute: path.join(applicationRoot, `${bundlesRoutePath}.json`)
      };

   if (wsRoot !== 'ws') {
      await _saveBundlesForEachModule(applicationRoot, result);
   }

   await pMap(
      Object.keys(pathsToSave),
      async key => {
         let json;

         //нам надо проверить, что нужные файлы уже были сгенерены(инкрементальная сборка)
         if (await fs.pathExists(pathsToSave[key])) {
            switch (key) {
               case 'bundlesRoute':
               case 'bundlesJson':
                  json = await fs.readJson(pathsToSave[key]);
                  break;
               default://bundles
                  //для bundles надо сначала удалить лишний код, а только потом парсить json
                  json = JSON.parse((await fs.readFile(pathsToSave[key], 'utf8')).slice(8, -1));
                  break;
            }
         }

         //если файл существует и мы его прочитали, то просто дополняем его свежесгенеренными результатами.
         if (json) {
            Object.keys(result[key]).forEach(option => {
               json[option] = result[key][option];
            });
         } else {
            json = result[key];
         }
         switch (key) {
            case 'bundlesRoute':
               await fs.outputJson(pathsToSave[key], json);
               logger.debug(`Записали bundlesRoute.json по пути: ${pathsToSave[key]}`);
               break;
            case 'bundlesJson':
               await fs.outputJson(pathsToSave[key], json);
               logger.debug(`Записали bundles.json по пути: ${pathsToSave[key]}`);
               break;
            default://bundles
               await fs.writeFile(pathsToSave[key], `bundles=${JSON.stringify(json)};`);
               logger.debug(`Записали bundles.js по пути: ${pathsToSave[key]}`);

               /**
                * Таска минификации выполняется до кастомной паковки, поэтому мы должны для СП также
                * сохранить .min бандл
                */
               if (splittedCore) {
                  await fs.writeFile(pathsToSave[key].replace(/\.js$/, '.min.js'), `bundles=${JSON.stringify(json)};`);
                  logger.debug(`Записали bundles.min.js по пути: ${path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.min.js')}`);
               }
               break;
         }
      }
   );
}

async function getAllConfigs(files, applicationRoot) {
   const configs = [];
   await pMap(
      files,
      async file => {
         const currentFileConfigs = await packHelpers.getConfigsFromPackageJson(path.join(applicationRoot, file), applicationRoot);
         configs.push(...currentFileConfigs);
      },
      {
         concurrency: 10
      }
   );
   return configs;
}

/**
 * Создаём кастомные пакеты по .package.json конфигурации.
 * Является общей для гранта и для гальпа, поскольку принимает массив конфигураций.
 * В гальпе её будем запускать(второй и последующие разы) в случае, когда какой-либо конфиг
 * начинает охватывать новые модули,
 */
async function generatePackageJsonConfigs(depsTree, configs, applicationRoot, bundlesOptions) {
   const results = {
      bundles: {},
      bundlesRoute: {}
   };

   await pMap(
      configs,
      async config => {
         const configNum = config.configNum ? 'конфигурация №' + config.configNum : '';
         try {

            /**
             * результатом выполнения функции мы сделаем объект, он будет содержать ряд опций:
             * 1)bundles: в нём будут храниться подвергнутые изменениям бандлы.
             * 2)bundlesRoute: тоже самое что и выше, только для bundlesRoute.
             */
            const currentResult = await _generateCustomPackage(depsTree, applicationRoot, config, bundlesOptions);
            Object.keys(currentResult.bundles).forEach(key => {
               results.bundles[key] = currentResult.bundles[key];
            });
            Object.keys(currentResult.bundlesRoute).forEach(key => {
               results.bundlesRoute[key] = currentResult.bundlesRoute[key];
            });
            logger.info(`Создан кастомный пакет по конфигурационному файлу ${config.packageName} - ${configNum}`);
         } catch (err) {
            logger.error({
               message: `Ошибка создания кастомного пакета по конфигурационному файлу ${config.packageName} - ${configNum}`,
               error: err
            });
         }
      },
      {
         concurrency: 3
      }
   );
   results.bundlesJson = results.bundles;
   await _saveCustomPackResults(results, applicationRoot, bundlesOptions.splittedCore);
}

module.exports = {
   getAllConfigs: getAllConfigs,
   generatePackageJsonConfigs: generatePackageJsonConfigs
};
