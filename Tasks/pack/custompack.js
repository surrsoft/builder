/* eslint-disable no-unlimited-disable*/
/* eslint-disable */
//sorry about that ¯\_(ツ)_/¯

const
   customPackage = require('../../lib/pack/customPackage'),
   logger = require('../../lib/logger').logger(),
   modDeps = require('../../packer/lib/moduleDependencies'),
   path = require('path'),
   fs = require('fs-extra');

/**
 * Создаем пакеты по конфигурациям
 * @param {Object} grunt
 * @param {DepGraph} dg - граф зависимостей
 * @param {Array} configs - массив конфигураций
 * @param {Array} configs.modules - массив вершин графа
 * @param {Array} [configs.include] - массив модулей, который нужно оставить
 * @param {Array} [configs.exclude] - массив модулей, которые надо исключить
 * @param {String} configs.output - имя выходного файла, может быть именем модуля
 * @param {String} root - корень статики
 * @param {String} applicationRoot - полный путь до корня сервиса
 * @param {Object} bundles - пакеты для requirejs конфигурации
 * @param {createGruntPackage~callback} taskDone - callback
 */
async function generatePackageJsonConfigs(configs, applicationRoot, bundlesOptions) {
   return new Promise((resolve, reject) => {
      if (badConfigs.length > 0) {
         logger.info(`Будет проигронировано ${badConfigs.length} конфигураций кастомной паковки. Смотри описание ошибки выше.`);
      }
      async.eachLimit(configs, 3, async(config) => {
         if (!config.isBadConfig) {

         }
         try {
            const configNum = config.configNum ? 'конфигурация №' + config.configNum : '';
            const result = await generateCustomPackage(config, applicationRoot, bundlesOptions);
         } catch (err) {
            if (err) {
               errors[config.packageName] = err;

               /**
                * Ошибка создания пакета. Удаляем все его упоминания из бандлов.
                */
               Object.keys(bundlesOptions.modulesInBundles).forEach(function(moduleName) {
                  if (bundlesOptions.modulesInBundles[moduleName] === config.packagePath) {
                     delete bundlesOptions.modulesInBundles[moduleName];
                  }
               });
               logger.error({
                  message: `Ошибка создания кастомного пакета по конфигурационному файлу ${config.packageName} - ${configNum}`,
                  error: err
               });
            } else {
               logger.debug(`Создан кастомный пакет по конфигурационному файлу ${config.packageName} - ${configNum}`);
            }
         }
      }, function(err, result) {
         if (err) {
            reject(err);
         }
         resolve(result);
      });
   });
}

function generateCustomPackage(dg, applicationRoot, packageConfig) {
   return new Promise((resolve, reject) => {
      try {
         let
            orderQueue,
            outputFile,
            packagePath;

         if (packageConfig.isBadConfig) {
            reject(new Error('Конфиг для кастомного пакета должен содержать опцию include для нового вида паковки.'))
         }
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

/**
 * TODO сделать общей для гранта и гальпа
 */
function taskDone(errors) {
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
}

module.exports = function gruntCustomPack(grunt) {
   const gruntGetAllConfigs = async(applicationRoot ,files) => {
      let promises = [];
      files.forEach((file) => {
         promises.push(customPackage.getConfigsFromPackageJson(path.join(applicationRoot, file)));
      });
      return (await Promise.all(promises)).reduce((previousValue, current) => previousValue.concat(current));
   };

   grunt.registerMultiTask('custompack', 'Задача кастомной паковки', async function() {
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

            //TODO эту штуку можно определять непосредственно внутри общего кода.
            wsRoot = await fs.pathExists(path.join(applicationRoot, 'resources/WS.Core')) ? 'resources/WS.Core' : 'ws',
            dg = await modDeps.getDependencyGraph(applicationRoot);

         let
            configsFiles = [],
            configsArray = [],
            bundlesRoutePath, taskDone;

         let sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);

         /**
          * Не рассматриваем конфигурации, которые расположены в директории ws, если сборка
          * для Сервиса Представлений, поскольку конфигурации из ws являются дублями конфигураций
          * из WS.Core и один и тот же код парсится дважды.
          * TODO Сделаем отдельной функцией, где будем проверять только конкретный конфиг. Будет также общей для
          * TODO гранта и гальпа
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

         configsArray = await gruntGetAllConfigs(applicationRoot, sourceFiles);
         /**
          * данный функционал мы внедрим непосредственно в построение пакета, перед его построением будем чекать,
          * хороший пакет или нет, и если нет, rejectить ошибку и выдавать предупреждение.
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
          */
         await generatePackageJsonConfigs(configsArray, applicationRoot, bundlesOptions);
         logger.info('Задача создания кастомных пакетов завершена.');
         done();
      } catch(err) {
         logger.error({
            message: 'Ошибка выполнения кастомной паковки',
            error: err
         });
      }
   });
}
