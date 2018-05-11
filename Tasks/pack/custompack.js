/* eslint-disable no-unlimited-disable*/
/* eslint-disable */
const
   customPackage = require('../../lib/pack/customPackage'),
   logger = require('../../lib/logger').logger();

function generateCustomPackage(dg, applicationRoot, packageConfig) {
   return new Promise((resolve, reject) => {
      try {
         let
            orderQueue,
            outputFile,
            packagePath;

         orderQueue = customPackage.getOrderQueue(dg, packageConfig, applicationRoot);
         outputFile = customPackage.getOutputFile(packageConfig, applicationRoot, dg, bundlesOptions);
         packagePath = customPackage.getBundlePath(outputFile, applicationRoot, wsRoot);

         orderQueue = orderQueue.filter(function(node) {
            if (node.plugin === 'js') {
               return node.amd;
            }
            return true;
         });

         if (packageConfig.platformPackage || !packageConfig.includeCore) {
            bundlesOptions.bundles[packagePath] = customPackage.generateBundle(orderQueue);
            customPackage.generateBundlesRouting(bundlesOptions.bundles[packagePath], packagePath, bundlesOptions.modulesInBundles);
         }

         orderQueue = packerDictionary.deleteModulesLocalization(orderQueue);
         orderQueue = packerDictionary.packerCustomDictionary(orderQueue, applicationRoot);

         packageConfig.outputFile = outputFile;
         packageConfig.packagePath = packagePath;
         bundlesOptions.outputs[packageConfig.outputFile] = 1;
         resolve();
      } catch(err) {
         reject(err);
      }
   });
}

module.exports = function gruntCustomPack(grunt) {
   grunt.registerMultiTask('custompack', function() {
      logger.info('Запускается задача создания кастомных пакетов.');

      const
         self = this,
         bundlesOptions = {
            bundles: {},
            modulesInBundles: {},
            outputs: {}
         };

      let
         root = this.data.root,
         applicationRoot = path.join(root, this.data.application),
         configsFiles = [],
         done = this.async(),
         dblSlashes = /\\/g,
         bundlesPath = 'ext/requirejs',
         wsRoot = grunt.file.exists(applicationRoot, 'resources/WS.Core') ? 'resources/WS.Core' : 'ws',
         bundlesRoutePath,
         taskDone, dg, configsArray, collectDepsAndIntersectsDone,
         startCreateCustomPacks;

      collectDepsAndIntersectsDone = function() {
         applicationRoot = applicationRoot.replace(dblSlashes, '/');
      };

      startCreateCustomPacks = function() {
         customPackage.createGruntPackage(grunt, configsArray, root, badConfigs, bundlesOptions, taskDone);
      };

      taskDone = function(errors) {
         const packageNames = Object.keys(errors);
         if (packageNames.length > 0) {
            packageNames.forEach(function(packageName) {
               logger.error(`Ошибка в кастомном пакете ${packageName}: ${errors[packageName]}`);
            });
            logger.error('Fatal error: Некоторые кастомные пакеты не были созданы. Данные пакеты будут проигнорированы и не попадут в бандлы. Подробнее в логах билдера');
         } else {
            logger.debug('Задача создания кастомных пакетов выполнена.');
         }

         applicationRoot = applicationRoot.replace(dblSlashes, '/');
         if (wsRoot !== 'ws') {
            saveBundlesForEachModule(grunt, applicationRoot);
         }
         bundlesRoutePath = path.join(wsRoot, bundlesPath, 'bundlesRoute').replace(dblSlashes, '/');
         grunt.file.write(path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.js'), `bundles=${JSON.stringify(bundlesOptions.bundles)};`);
         logger.debug(`Записали bundles.js по пути: ${path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.js')}`);

         grunt.file.write(path.join(applicationRoot, wsRoot, bundlesPath, 'output.json'), `${JSON.stringify(bundlesOptions.outputs)}`);
         logger.debug(`Записали output.json по пути: ${path.join(applicationRoot, wsRoot, bundlesPath, 'output.json')}`);
         grunt.file.write(path.join(applicationRoot, `${bundlesRoutePath}.json`), JSON.stringify(bundlesOptions.modulesInBundles));
         logger.debug(`Записали bundlesRoute.json по пути: ${path.join(applicationRoot, `${bundlesRoutePath}.json`)}`);
         grunt.file.write(path.join(applicationRoot, `${bundlesRoutePath}.js`), `define("${bundlesRoutePath}",[],function(){return ${JSON.stringify(bundlesOptions.modulesInBundles)};});`);

         /**
          * Таска минификации выполняется до кастомной паковки, поэтому мы должны для СП также
          * сохранить .min бандл
          */
         if (bundlesOptions.splittedCore) {
            grunt.file.write(path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.min.js'), `bundles=${JSON.stringify(bundlesOptions.bundles)};`);
            logger.debug(`Записали bundles.min.js по пути: ${path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.min.js')}`);
         }
         done();
      };

      if (!modDeps.checkModuleDependenciesSanity(applicationRoot, taskDone)) {
         return;
      }

      dg = modDeps.getDependencyGraph(applicationRoot);

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

      sourceFiles.forEach(function(pathToSource) {
         configsFiles.push(path.join(applicationRoot, pathToSource));
      });

      configsArray = customPackage.getConfigs(grunt, configsFiles, applicationRoot, badConfigs);

      if (badConfigs && badConfigs.length > 0) {
         let errorMessage = '[ERROR] Опция "include" отсутствует или является пустым массивом!' +
            ' Список конфигурационных файлов с данной ошибкой: ';
         errorMessage += badConfigs.map(function(item) {
            return '"' + item.path + '"';
         }).join(', ');
         logger.error(errorMessage);
      }

      bundlesOptions.splittedCore = this.data.splittedCore;
      customPackage.collectDepsAndIntersects(dg, configsArray, applicationRoot, wsRoot, bundlesOptions, collectDepsAndIntersectsDone);
   });
}
