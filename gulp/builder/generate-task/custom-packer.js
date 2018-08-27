/**
 * Генерация задачи кастомной паковки.
 * @author Колбешин Ф.А.
 */

'use strict';
const gulp = require('gulp'),
   path = require('path'),
   generateCollectPackageJson = require('../plugins/collect-custom-packages'),
   logger = require('../../../lib/logger').logger(),
   DependencyGraph = require('../../../packer/lib/dependency-graph'),
   plumber = require('gulp-plumber'),
   customPacker = require('../../../lib/pack/custom-packer'),
   { saveCustomPackResults } = require('../../../lib/pack/custom-packer');

/**
 * Генерация задачи кастомной паковки.
 * @param {TaskParameters} taskParameters параметры для задач
 * @returns {Undertaker.TaskFunction|function(done)} В debug режиме вернёт пустышку, чтобы gulp не упал
 */
function generateTaskForCustomPack(taskParameters) {
   const root = taskParameters.config.rawConfig.output,
      depsTree = new DependencyGraph(),
      configs = {
         priorityConfigs: [],
         normalConfigs: []
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

   const generateCollectPackagesTasks = taskParameters.config.modules.map((moduleInfo) => {
      const moduleOutput = path.join(root, path.basename(moduleInfo.output));
      const input = path.join(moduleOutput, '/**/*.package.json');
      return function collectPackageJson() {
         return gulp
            .src(input, { dot: false, nodir: true })
            .pipe(
               plumber({
                  errorHandler(err) {
                     logger.error({
                        message: 'Задача custompack завершилась с ошибкой',
                        error: err,
                        moduleInfo
                     });
                     this.emit('end');
                  }
               })
            )
            .pipe(generateCollectPackageJson(configs, root));
      };
   });

   return gulp.series(
      generateDepsGraphTask(depsTree, taskParameters.cache),
      gulp.parallel(generateCollectPackagesTasks),
      generateCustomPackageTask(configs, taskParameters, depsTree, results, root),
      generateSaveResultsTask(taskParameters.config, results, root)
   );
}

function generateCustomPackageTask(configs, taskParameters, depsTree, results, root) {
   return function custompack() {
      return customPacker.generateCurrentCustomPackage(configs, taskParameters, depsTree, results, root);
   };
}

function generateSaveResultsTask(config, results, applicationRoot) {
   return function saveCustomPackerResults() {
      results.bundlesJson = results.bundles;
      return saveCustomPackResults(results, applicationRoot, true, true);
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
