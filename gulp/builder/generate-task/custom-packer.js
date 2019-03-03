/**
 * Генерация задачи кастомной паковки.
 * @author Колбешин Ф.А.
 */

'use strict';
const gulp = require('gulp'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   DependencyGraph = require('../../../packer/lib/dependency-graph'),
   collectCustomPacks = require('../plugins/collect-custom-packs'),
   finalizeOptimizeDistrib = require('../plugins/finalize-optimize-distrib'),
   plumber = require('gulp-plumber'),
   {
      saveModuleCustomPackResults,
      saveRootBundlesMeta,
      generateAllCustomPackages,
      collectAllIntersects,
      setSuperBundle
   } = require('../../../lib/pack/custom-packer'),
   pMap = require('p-map'),
   fs = require('fs-extra'),
   transliterate = require('../../../lib/transliterate');

function generateSetSuperBundles(root, configs) {
   return function setSuperBundles() {
      return setSuperBundle(root, configs);
   };
}

/**
 * Генерация задачи сбора кастомных пакетов
 * @param {TaskParameters} taskParameters набор параметров Gulp - конфигурация, кэш
 * @param {BuildConfiguration} configs набор кастомных пакетов проекта.
 * @param {String} root корень приложения
 * @returns {Undertaker.TaskFunction}
 */
function generateCollectPackagesTasks(configs, taskParameters, root) {
   const { commonBundles, superBundles } = configs;
   const tasks = taskParameters.config.modules.map((moduleInfo) => {
      const moduleOutput = path.join(root, transliterate(moduleInfo.name));
      const input = path.join(moduleOutput, '/**/*.package.json');
      return function collectPackageJson() {
         return gulp
            .src(input, { dot: false, nodir: true })
            .pipe(
               plumber({
                  errorHandler(err) {
                     logger.error({
                        message: 'Задача collectPackageJson завершилась с ошибкой',
                        error: err,
                        moduleInfo
                     });
                     this.emit('end');
                  }
               })
            )
            .pipe(collectCustomPacks(root, commonBundles, superBundles));
      };
   });
   return gulp.series(
      gulp.parallel(tasks),
      generateSetSuperBundles(root, configs)
   );
}

/**
 * Генерация задачи кастомной паковки.
 * @param {TaskParameters} taskParameters параметры для задач
 * @returns {Undertaker.TaskFunction|function(done)} В debug режиме вернёт пустышку, чтобы gulp не упал
 */
function generateTaskForCustomPack(taskParameters) {
   if (!taskParameters.config.customPack) {
      return function skipCustomPack(done) {
         done();
      };
   }
   const root = taskParameters.config.rawConfig.output,
      depsTree = new DependencyGraph(),
      configs = {
         commonBundles: {},
         superBundles: []
      },
      results = {
         bundles: {},
         bundlesRoute: {},
         excludedCSS: {}
      };

   if (!taskParameters.config.isReleaseMode) {
      return function skipCustomPack(done) {
         done();
      };
   }

   return gulp.series(
      generateDepsGraphTask(depsTree, taskParameters.cache),
      generateCollectPackagesTasks(configs, taskParameters, root),
      generateCustomPackageTask(configs, taskParameters, depsTree, results, root),
      generateInterceptCollectorTask(taskParameters, root, results),
      generateSaveResultsTask(taskParameters, results, root),
      generateFinalizeOptimizing(taskParameters, root)
   );
}

/**
 * мини-таска для пост-обработки конечной директории.
 * Удаляем файлы, которые были необходимы исключительно
 * для паковки, а также все минифицированные AMD-модули
 * и стили, попавшие в публичные(содержатся в оглавлении бандлов)
 * кастомные пакеты.
 * @param taskParameters - набор параметров текущей сборки.
 * @param root
 * @returns {*}
 */
function generateFinalizeOptimizing(taskParameters, root) {
   if (taskParameters.config.sources) {
      return function skipFinalizeOptimizing(done) {
         done();
      };
   }
   taskParameters.filesToRemove = [];
   const tasks = taskParameters.config.modules.map((moduleInfo) => {
      const moduleOutput = path.join(root, transliterate(moduleInfo.name));
      const input = path.join(moduleOutput, '/**/*.*');
      return function finalizeOptimizing() {
         return gulp
            .src(input, { dot: false, nodir: true })
            .pipe(
               plumber({
                  errorHandler(err) {
                     logger.error({
                        message: 'Задача finalizeOptimizing завершилась с ошибкой',
                        error: err,
                        moduleInfo
                     });
                     this.emit('end');
                  }
               })
            )
            .pipe(finalizeOptimizeDistrib(taskParameters));
      };
   });
   return gulp.series(
      gulp.parallel(tasks),
      generateRemoveMinInPackages(taskParameters)
   );
}

async function removeMinInPackages(taskParameters) {
   await pMap(
      taskParameters.filesToRemove,
      async(modulePath) => {
         await fs.remove(modulePath);
      },
      {
         concurrency: 20
      }
   );
}

function generateRemoveMinInPackages(taskParameters) {
   return function removeMinInPackagesTask() {
      return removeMinInPackages(taskParameters);
   };
}

function generateCustomPackageTask(configs, taskParameters, depsTree, results, root) {
   return function custompack() {
      return generateAllCustomPackages(configs, taskParameters, depsTree, results, root);
   };
}


function generateInterceptCollectorTask(taskParameters, root, results) {
   if (taskParameters.config.sources) {
      return function collectIntercepts() {
         return collectAllIntersects(root, results);
      };
   }
   return function skipCollectIntersects(done) {
      done();
   };
}

function generateSaveResultsTask(taskParameters, results, applicationRoot) {
   return async function saveCustomPackerResults() {
      if (taskParameters.config.joinedMeta) {
         await saveRootBundlesMeta(applicationRoot, results);
      }
      await saveModuleCustomPackResults(taskParameters, results, applicationRoot);
   };
}

function generateDepsGraphTask(depsTree, cache) {
   return function generateDepsGraph(done) {
      const moduleDeps = cache.getModuleDependencies(),
         currentNodes = Object.keys(moduleDeps.nodes),
         currentLinks = Object.keys(moduleDeps.links);

      if (currentLinks.length > 0) {
         currentLinks.forEach((link) => {
            depsTree.setLink(link, moduleDeps.links[link]);
         });
      }
      if (currentNodes.length > 0) {
         currentNodes.forEach((node) => {
            const currentNode = moduleDeps.nodes[node];
            currentNode.path = currentNode.path.replace(/^resources\//, '');
            depsTree.setNode(node, currentNode);
         });
      }
      done();
   };
}

module.exports = generateTaskForCustomPack;
