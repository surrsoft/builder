/* eslint-disable no-unlimited-disable*/
/* eslint-disable */
//sorry about that ¯\_(ツ)_/¯

const
   customPackage = require('../../lib/pack/customPackage'),
   logger = require('../../lib/logger').logger(),
   modDeps = require('../../packer/lib/moduleDependencies'),
   path = require('path'),
   fs = require('fs-extra'),
   pMap = require('p-map');

/**
 * Создаём кастомные пакеты по .package.json конфигурации.
 * Является общей для гранта и для гальпа, поскольку принимает массив конфигураций.
 * В гальпе её будем запускать(второй и последующие разы) в случае, когда какой-либо конфиг
 * начинает охватывать новые модули,
 */
async function generatePackageJsonConfigs(depsTree, configs, applicationRoot, bundlesOptions) {
   return new Promise((resolve) => {
      async.eachLimit(configs, 3, async (config) => {
         try {
            const configNum = config.configNum ? 'конфигурация №' + config.configNum : '';
            /**
             * результатом выполнения функции мы сделаем объект, он будет содержать ряд опций:
             * 1)bundles: в нём будут храниться подвергнутые изменениям бандлы.
             * 2)bundlesRoute: тоже самое что и выше, только для bundlesRoute.
             * 3)oldBundles: для гальпа.
             * 4)oldBundlesRoute: для гальпа.
             */
            const result = await generateCustomPackage(depsTree, config, applicationRoot, bundlesOptions.splittedCore);
            logger.info(`Создан кастомный пакет по конфигурационному файлу ${config.packageName} - ${configNum}`);
         } catch (err) {
            logger.error({
               message: `Ошибка создания кастомного пакета по конфигурационному файлу ${config.packageName} - ${configNum}`,
               error: err
            });
         }
      }, function (err, result) {
         resolve(result);
      });
   });
}

function generateCustomPackage(depsTree, applicationRoot, packageConfig, isSplittedCore) {
   return new Promise(async(resolve, reject) => {
      try {
         const result = {
            bundles: {},
            bundlesRoute: {},
            oldBundles: {},
            oldBundlesRoute: {}
         };

         let
            orderQueue,
            outputFile,
            packagePath;

         if (packageConfig.isBadConfig) {
            reject(new Error('Конфиг для кастомного пакета должен содержать опцию include для нового вида паковки.'))
         }
         orderQueue = customPackage.getOrderQueue(depsTree, packageConfig, applicationRoot);
         outputFile = customPackage.getOutputFile(packageConfig, applicationRoot, depsTree, isSplittedCore);
         packagePath = customPackage.getBundlePath(outputFile, applicationRoot, wsRoot);

         orderQueue = orderQueue.filter(function (node) {
            if (node.plugin === 'js') {
               return node.amd;
            }
            return true;
         });

         if (packageConfig.platformPackage || !packageConfig.includeCore) {
            result.bundles[packagePath] = customPackage.generateBundle(orderQueue);
            result.bundlesRoute = customPackage.generateBundlesRouting(result.bundles[packagePath], packagePath);
         }

         orderQueue = packerDictionary.deleteModulesLocalization(orderQueue);
         orderQueue = await packerDictionary.packerCustomDictionary(orderQueue, applicationRoot);

         /**
          * здесь будем вызывать ту часть пакера, отвечающую за сохранение пакета.
          * TODO доделать
          */

         packageConfig.outputFile = outputFile;
         packageConfig.packagePath = packagePath;
         result.output = packageConfig.outputFile;
         resolve(result);
      } catch (err) {
         reject(err);
      }
   });
}

async function saveBundlesForEachModule(grunt, applicationRoot) {
   Object.keys(bundlesOptions.bundles).forEach(function(currentBundle) {
      let
         bundlePath = path.normalize(path.join(applicationRoot, `${currentBundle.match(/^resources\/[^/]+/)}`, 'bundlesRoute.json')),
         currentModules = bundlesOptions.bundles[currentBundle],
         bundleRouteToWrite = grunt.file.exists(bundlePath) ? JSON.parse(grunt.file.read(bundlePath)) : {};

      currentModules.forEach(function(node) {
         if (node.indexOf('css!') === -1) {
            bundleRouteToWrite[node] = currentBundle;
         }
      });
      grunt.file.write(bundlePath, JSON.stringify(bundleRouteToWrite));
   });
}

/**
 * TODO сделать общей для гранта и гальпа
 * практически готова, также реализовано сохранение бандлов для инкрементальной сборки.
 */
async function saveCustomPackResults(result, wsRoot, applicationRoot) {

   const
      bundlesPath = 'ext/requirejs',
      bundlesRoutePath = path.join(wsRoot, bundlesPath, 'bundlesRoute').replace(dblSlashes, '/'),
      pathsToSave = {
         bundles: path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.js'),
         output: path.join(applicationRoot, wsRoot, bundlesPath, 'output.json'),
         bundlesRouteJson: path.join(applicationRoot, `${bundlesRoutePath}.json`)
      };

   if (wsRoot !== 'ws') {
      await saveBundlesForEachModule(applicationRoot);
   }

   await pMap(
      Object.keys(pathsToSave),
      async key => {
         let json;
         //нам надо проверить, что нужные файлы уже были сгенерены(инкрементальная сборка)
         if (await fs.pathExists(pathsToSave[key])) {
            switch(key) {
               case 'bundlesRouteJson':
               case 'output':
                  json = await fs.readJson(pathsToSave[key]);
                  break;
               case 'bundles':
                  //для bundles надо сначала удалить лишний код, а только потом парсить json
                  json = JSON.parse((await fs.readFile(pathsToSave[key], 'utf8')).slice(8, -1))
                  break;
            }
         }
         //если файл существует и мы его прочитали, то просто дополняем его свежесгенеренными результатами.
         if (json) {
            Object.keys(result[key]).forEach(option => {
               json[option] = result[key][option];
            });
         }
         switch(key) {
            case 'bundlesRouteJson':
               await fs.outputJson(pathsToSave[key], json);
               logger.debug(`Записали bundlesRoute.json по пути: ${pathsToSave[key]}`);
               break;
            case 'output':
               await fs.outputJson(pathsToSave[key], json);
               logger.debug(`Записали output.json по пути: ${pathsToSave[key]}`);
               break;
            case 'bundles':
               await fs.writeFile(pathsToSave[key], `bundles=${JSON.stringify(json)};`);
               logger.debug(`Записали bundles.js по пути: ${pathsToSave[key]}`);
               break;
         }
      }
   );

   /**
    * Таска минификации выполняется до кастомной паковки, поэтому мы должны для СП также
    * сохранить .min бандл
    */
   if (bundlesOptions.splittedCore) {
      grunt.file.write(path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.min.js'), `bundles=${JSON.stringify(bundlesOptions.bundles)};`);
      logger.debug(`Записали bundles.min.js по пути: ${path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.min.js')}`);
   }
}

module.exports = function gruntCustomPack(grunt) {
   const gruntGetAllConfigs = async (applicationRoot, files) => {
      let promises = [];
      files.forEach((file) => {
         promises.push(customPackage.getConfigsFromPackageJson(path.join(applicationRoot, file)));
      });
      return (await Promise.all(promises)).reduce((previousValue, current) => previousValue.concat(current));
   };

   grunt.registerMultiTask('custompack', 'Задача кастомной паковки', async function () {
      logger.info('Запускается задача создания кастомных пакетов.');
      try {
         const
            self = this,
            bundlesOptions = {
               bundles: {},
               modulesInBundles: {},
               outputs: {}
            },
            applicationRoot = path.join(self.data.root, self.data.application),
            done = self.async(),
            dblSlashes = /\\/g,
            bundlesPath = 'ext/requirejs',

            //wsRoot важен для обоих видов сборок, оставляем как в гранте, так и гальпе, выносить в отдельную функцию не вижу смысла
            wsRoot = await fs.pathExists(path.join(applicationRoot, 'resources/WS.Core')) ? 'resources/WS.Core' : 'ws',
            //
            dg = await modDeps.getDependencyGraph(applicationRoot);

         let sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);

         /**
          * Не рассматриваем конфигурации, которые расположены в директории ws, если сборка
          * для Сервиса Представлений, поскольку конфигурации из ws являются дублями конфигураций
          * из WS.Core и один и тот же код парсится дважды.
          * Будем чекать рассматриваемый конфиг функцией checkConfigPathForSplittedCore
          */
         if (wsRoot !== 'ws') {
            sourceFiles = sourceFiles.filter(function (pathToSource) {
               return customPackage.checkConfigPathForSplittedCore(pathToSource);
            });
         }

         /**
          * для гранта выдёргиваем все конфиги, а для гальпа будем использовать только одну функцию
          * getConfigsFromPackageJson для конкретного package.json в рамках инкрементальной сборки
          */

         const configsArray = await gruntGetAllConfigs(applicationRoot, sourceFiles);
         /**
          * TODO данный функционал мы внедрим непосредственно в построение пакета, перед его построением будем чекать,
          * TODO хороший пакет или нет, и если нет, rejectить ошибку и выдавать предупреждение.
          */
         /*if (badConfigs && badConfigs.length > 0) {
            let errorMessage = '[ERROR] Опция "include" отсутствует или является пустым массивом!' +
               ' Список конфигурационных файлов с данной ошибкой: ';
            errorMessage += badConfigs.map(function(item) {
               return '"' + item.path + '"';
            }).join(', ');
            logger.error(errorMessage);
         }*/

         bundlesOptions.splittedCore = this.data.splittedCore;
         /**
          * Для конкретного конфига генерим непосредственно пакет.
          * Общая функция для гальпа и гранта
          * TODO доработать
          */
         await generatePackageJsonConfigs(configsArray, applicationRoot, bundlesOptions);
         logger.info('Задача создания кастомных пакетов завершена.');
         done();
      } catch (err) {
         logger.error({
            message: 'Ошибка выполнения кастомной паковки',
            error: err
         });
      }
   });
}
