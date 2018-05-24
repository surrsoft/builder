/* eslint-disable no-invalid-this */
/* eslint-disable no-restricted-properties */
'use strict';

const
   customPackage = require('../../lib/pack/customPackage'),
   commonPackage = require('../../packer/lib/commonPackage'),
   packerDictionary = require('../../packer/tasks/lib/packDictionary'),
   logger = require('../../lib/logger').logger(),
   modDeps = require('../../packer/lib/moduleDependencies'),
   path = require('path'),
   fs = require('fs-extra'),
   pMap = require('p-map'),
   packCSS = require('../../packer/tasks/lib/packCSS').promisedPackCSS;

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
            const currentResult = await generateCustomPackage(depsTree, applicationRoot, config, bundlesOptions.splittedCore);
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
   await saveCustomPackResults(results, applicationRoot, bundlesOptions.splittedCore);
}

async function writeCustomPackage(packageConfig, applicationRoot) {
   const
      currentFileExists = await fs.pathExists(packageConfig.outputFile),
      originalFileExists = await fs.pathExists(customPackage.originalPath(packageConfig.outputFile));

   // Не будем портить оригинальный файл.
   if (currentFileExists && !originalFileExists) {
      await fs.copy(packageConfig.outputFile, customPackage.originalPath(packageConfig.outputFile));
   }
   const result = await commonPackage.limitingNativePackFiles(packageConfig.orderQueue, applicationRoot);
   await fs.writeFile(packageConfig.outputFile, result ? result.reduce((res, modContent) => res + (res ? '\n' : '') + modContent) : '');
}

async function generateCustomPackage(depsTree, applicationRoot, packageConfig, isSplittedCore) {
   const
      outputFile = customPackage.getOutputFile(packageConfig, applicationRoot, depsTree, isSplittedCore),
      packagePath = customPackage.getBundlePath(outputFile, applicationRoot, isSplittedCore ? 'resources/WS.Core' : 'ws'),
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
   orderQueue = customPackage.getOrderQueue(depsTree, packageConfig, applicationRoot)
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
      result.bundles[packagePath] = await customPackage.generateBundle(orderQueue, isSplittedCore);
      result.bundlesRoute = customPackage.generateBundlesRouting(result.bundles[packagePath], packagePath);
   }

   orderQueue = packerDictionary.deleteModulesLocalization(orderQueue);
   packageConfig.orderQueue = await packerDictionary.packerCustomDictionary(orderQueue, applicationRoot);
   packageConfig.outputFile = outputFile;
   packageConfig.packagePath = packagePath;
   result.output = packageConfig.outputFile;

   await writeCustomPackage(packageConfig, applicationRoot);
   return result;
}

/**
 * Функция, которая сплитит результат работы таски custompack в секции bundles
 * и ра
 * @param applicationRoot
 * @returns {Promise<void>}
 */
async function saveBundlesForEachModule(applicationRoot, result) {
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
 * Могёт в инкрементальную сборку
 */
async function saveCustomPackResults(result, applicationRoot, splittedCore) {
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
      await saveBundlesForEachModule(applicationRoot, result);
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
         const currentFileConfigs = await customPackage.getConfigsFromPackageJson(path.join(applicationRoot, file), applicationRoot);
         configs.push(...currentFileConfigs);
      },
      {
         concurrency: 10
      }
   );
   return configs;
}

module.exports = function gruntCustomPack(grunt) {
   grunt.registerMultiTask('custompack', 'Задача кастомной паковки', async function() {
      logger.info('Запускается задача создания кастомных пакетов.');
      let time = new Date();
      logger.info(`Запущена задача в ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}`);
      try {
         const
            self = this,
            bundlesOptions = {
               bundles: {},
               modulesInBundles: {},
               outputs: {},
               splittedCore: self.data.splittedCore
            },
            applicationRoot = path.join(self.data.root, self.data.application),
            done = self.async(),

            //wsRoot важен для обоих видов сборок, оставляем как в гранте, так и гальпе, выносить в отдельную функцию не вижу смысла
            wsRoot = await fs.pathExists(path.join(applicationRoot, 'resources/WS.Core')) ? 'resources/WS.Core' : 'ws',
            depsTree = await modDeps.getDependencyGraph(applicationRoot, bundlesOptions.splittedCore);

         let sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);

         /**
          * Не рассматриваем конфигурации, которые расположены в директории ws, если сборка
          * для Сервиса Представлений, поскольку конфигурации из ws являются дублями конфигураций
          * из WS.Core и один и тот же код парсится дважды.
          */
         if (wsRoot !== 'ws') {
            sourceFiles = sourceFiles.filter(function(pathToSource) {
               return !/^ws/.test(pathToSource);
            });
         }

         /**
          * для гранта выдёргиваем все конфиги, а для гальпа будем использовать только одну функцию
          * getConfigsFromPackageJson для конкретного package.json в рамках инкрементальной сборки
          */

         const configsArray = await getAllConfigs(sourceFiles, applicationRoot);
         if (configsArray.length === 0) {
            logger.info('Конфигураций не обнаружено.');
         }
         await generatePackageJsonConfigs(depsTree, configsArray, applicationRoot, bundlesOptions);
         logger.info('Задача создания кастомных пакетов завершена.');
         time = new Date();
         logger.info(`Запущена задача в ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}`);
         done();
      } catch (err) {
         logger.error({
            message: 'Ошибка выполнения кастомной паковки',
            error: err
         });
      }
   });
};
