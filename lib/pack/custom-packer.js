'use strict';

const commonPackage = require('../../packer/lib/commonPackage'),
   fs = require('fs-extra'),
   logger = require('../../lib/logger').logger(),
   { promisedPackCSS } = require('../../packer/tasks/lib/packCSS'),
   packerDictionary = require('../../packer/tasks/lib/packDictionary'),
   packHelpers = require('./helpers/custompack'),
   path = require('path'),
   pMap = require('p-map');

async function writeCustomPackage(packageConfig, applicationRoot, splittedCore) {
   const currentFileExists = await fs.pathExists(packageConfig.outputFile),
      originalFileExists = await fs.pathExists(packHelpers.originalPath(packageConfig.outputFile));

   // Не будем портить оригинальный файл.
   if (currentFileExists && !originalFileExists) {
      await fs.copy(packageConfig.outputFile, packHelpers.originalPath(packageConfig.outputFile));
   }
   const result = await commonPackage.limitingNativePackFiles(packageConfig.orderQueue, applicationRoot);
   if (packageConfig.cssModulesFromOrderQueue.length > 0) {
      result.unshift(
         packHelpers.generateLinkForCss(packageConfig.cssModulesFromOrderQueue, packageConfig.packagePath, splittedCore)
      );
   }

   if (packageConfig.optimized) {
      await fs.outputFile(packageConfig.outputFile, packHelpers.generatePackageToWrite(result));
   } else {
      await fs.outputFile(
         packageConfig.outputFile,
         result ? result.reduce((res, modContent) => res + (res ? '\n' : '') + modContent) : ''
      );
   }
}

async function generateCustomPackage(
   depsTree,
   applicationRoot,
   packageConfig,
   isSplittedCore,
   isGulp,
   availableLanguage
) {
   const outputFile = packHelpers.getOutputFile(packageConfig, applicationRoot, depsTree, isSplittedCore),
      packagePath = packHelpers.getBundlePath(outputFile, applicationRoot, isSplittedCore ? 'resources/WS.Core' : 'ws'),
      bundlePath = isGulp ? `resources${packagePath[0] !== '/' ? '/' : ''}${packagePath}` : packagePath,
      pathToCustomCSS = outputFile.replace(/\.js$/, '.css'),
      result = {
         bundles: {},
         bundlesRoute: {}
      };

   let cssModulesFromOrderQueue = [],
      orderQueue;

   if (packageConfig.isBadConfig) {
      throw new Error('Конфиг для кастомного пакета должен содержать опцию include для нового вида паковки.');
   }
   orderQueue = packHelpers.getOrderQueue(depsTree, packageConfig, applicationRoot).filter((node) => {
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
      const cssRes = await promisedPackCSS(
         cssModulesFromOrderQueue.css
            .filter(function removeControls(module) {
               if (packageConfig.themeName) {
                  return (
                     !module.fullName.startsWith('css!SBIS3.CONTROLS/') && !module.fullName.startsWith('css!Controls/')
                  );
               }
               return true;
            })
            .map(function onlyPath(module) {
               return module.fullPath;
            }),
         applicationRoot,
         isGulp
      );
      await fs.outputFile(pathToCustomCSS, cssRes);
   }

   if (packageConfig.platformPackage || !packageConfig.includeCore) {
      result.bundles[bundlePath] = await packHelpers.generateBundle(
         orderQueue,
         cssModulesFromOrderQueue.css,
         isSplittedCore
      );
      result.bundlesRoute = packHelpers.generateBundlesRouting(result.bundles[bundlePath], bundlePath);
   }

   orderQueue = packerDictionary.deleteModulesLocalization(orderQueue);
   packageConfig.orderQueue = await packerDictionary.packerCustomDictionary(
      orderQueue,
      applicationRoot,
      depsTree,
      availableLanguage
   );
   packageConfig.outputFile = outputFile;
   packageConfig.packagePath = packagePath;
   packageConfig.cssModulesFromOrderQueue = cssModulesFromOrderQueue.css;
   result.output = packageConfig.outputFile;

   await writeCustomPackage(packageConfig, applicationRoot, isSplittedCore);
   return result;
}

/**
 * Функция, которая сплитит результат работы таски custompack в секции bundles
 */
async function saveBundlesForEachModule(applicationRoot, result, isGulp) {
   /**
    * Сделаем список json на запись, нам надо защититься от параллельной перезаписи
    */
   const jsonToWrite = {};
   await pMap(
      Object.keys(result.bundles),
      async(currentBundle) => {
         const intModuleName = currentBundle.match(/^resources\/([^/]+)/)[1],
            currentModules = result.bundles[currentBundle];
         let bundlePath;
         if (isGulp) {
            bundlePath = intModuleName;
         } else {
            bundlePath = `resources/${intModuleName}`;
         }
         bundlePath = path.normalize(path.join(applicationRoot, bundlePath, 'bundlesRoute.json'));

         if (await fs.pathExists(bundlePath)) {
            jsonToWrite[bundlePath] = await fs.readJson(bundlePath);
         }

         if (!jsonToWrite[bundlePath]) {
            jsonToWrite[bundlePath] = {};
         }

         currentModules.forEach((node) => {
            if (node.indexOf('css!') === 0) {
               jsonToWrite[bundlePath][node] = `${currentBundle}.css`;
            } else {
               jsonToWrite[bundlePath][node] = `${currentBundle}.js`;
            }
         });
      },
      {
         concurrency: 10
      }
   );
   await pMap(Object.keys(jsonToWrite), key => fs.writeJson(key, jsonToWrite[key]), {
      concurrency: 10
   });
}

/**
 * Сохраняем результаты работы кастомной паковки для всех секций.
 */
async function saveCustomPackResults(result, applicationRoot, splittedCore, isGulp) {
   let wsRoot;
   if (isGulp) {
      wsRoot = 'WS.Core';
   } else {
      wsRoot = splittedCore ? 'resources/WS.Core' : 'ws';
   }
   const bundlesPath = 'ext/requirejs',
      bundlesRoutePath = path.join(wsRoot, bundlesPath, 'bundlesRoute').replace(/\\/g, '/'),
      pathsToSave = {
         bundles: path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.js'),
         bundlesJson: path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.json'),
         bundlesRoute: path.join(applicationRoot, `${bundlesRoutePath}.json`)
      };

   if (wsRoot !== 'ws') {
      await saveBundlesForEachModule(applicationRoot, result, isGulp);
   }

   await pMap(Object.keys(pathsToSave), async(key) => {
      let json;

      // нам надо проверить, что нужные файлы уже были сгенерены(инкрементальная сборка)
      if (await fs.pathExists(pathsToSave[key])) {
         switch (key) {
            case 'bundlesRoute':
            case 'bundlesJson':
               json = await fs.readJson(pathsToSave[key]);
               break;
            default:
               // bundles
               try {
                  // для bundles надо сначала удалить лишний код, а только потом парсить json
                  json = JSON.parse((await fs.readFile(pathsToSave[key], 'utf8')).slice(8, -1));
               } catch (error) {
                  logger.debug({
                     message: `Проблема с разбором файла ${pathsToSave[key]}. Но это скорее всего нормально`,
                     error
                  });
               }
               break;
         }
      }

      // если файл существует и мы его прочитали, то просто дополняем его свежесгенеренными результатами.
      if (json) {
         Object.keys(result[key]).forEach((option) => {
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
         default:
            // bundles
            await fs.writeFile(pathsToSave[key], `bundles=${JSON.stringify(json)};`);
            logger.debug(`Записали bundles.js по пути: ${pathsToSave[key]}`);

            /**
             * Таска минификации выполняется до кастомной паковки, поэтому мы должны для СП также
             * сохранить .min бандл
             */
            if (splittedCore) {
               await fs.writeFile(pathsToSave[key].replace(/\.js$/, '.min.js'), `bundles=${JSON.stringify(json)};`);
               logger.debug(
                  `Записали bundles.min.js по пути: ${path.join(
                     applicationRoot,
                     wsRoot,
                     bundlesPath,
                     'bundles.min.js'
                  )}`
               );
            }
            break;
      }
   });
}

async function getAllConfigs(files, applicationRoot) {
   const configs = [];
   await pMap(
      files,
      async(file) => {
         const packagePath = path.join(applicationRoot, file);
         let cfgContent;
         try {
            cfgContent = await fs.readJson(packagePath);
         } catch (err) {
            logger.error({
               message: 'Ошибка парсинга конфигурации кастомной паковки',
               error: err,
               filePath: file
            });
         }
         const currentFileConfigs = packHelpers.getConfigsFromPackageJson(packagePath, applicationRoot, cfgContent);
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
async function generatePackageJsonConfigs(
   depsTree,
   configs,
   applicationRoot,
   isSplittedCore,
   isGulp,
   availableLanguage
) {
   const results = {
      bundles: {},
      bundlesRoute: {}
   };

   await pMap(
      configs,
      async(config) => {
         const configNum = config.configNum ? `конфигурация №${config.configNum}` : '';
         try {
            /**
             * результатом выполнения функции мы сделаем объект, он будет содержать ряд опций:
             * 1)bundles: в нём будут храниться подвергнутые изменениям бандлы.
             * 2)bundlesRoute: тоже самое что и выше, только для bundlesRoute.
             */
            const currentResult = await generateCustomPackage(
               depsTree,
               applicationRoot,
               config,
               isSplittedCore,
               isGulp,
               availableLanguage
            );
            packHelpers.appendBundlesOptionsToCommon(currentResult, results, 'bundles');
            packHelpers.appendBundlesOptionsToCommon(currentResult, results, 'bundlesRoute');
            logger.info(`Создан кастомный пакет по конфигурационному файлу ${config.packageName} - ${configNum}`);
         } catch (err) {
            logger.error({
               message: `Ошибка создания кастомного пакета по конфигурационному файлу ${
                  config.packageName
               } - ${configNum}`,
               error: err
            });
         }
      },
      {
         concurrency: 3
      }
   );
   return results;
}

module.exports = {
   getAllConfigs,
   generatePackageJsonConfigs,
   saveCustomPackResults,
   generateCustomPackage
};
