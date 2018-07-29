/**
 * Генерация задачи кастомной паковки.
 * @author Колбешин Ф.А.
 */

'use strict';
const gulp = require('gulp'),
   path = require('path'),
   generatePackageJson = require('../plugins/custom-packer'),
   logger = require('../../../lib/logger').logger(),
   DependencyGraph = require('../../../packer/lib/dependency-graph'),
   plumber = require('gulp-plumber'),
   { saveCustomPackResults } = require('../../../lib/pack/custom-packer');

/**
 * Генерация задачи кастомной паковки.
 * @param {TaskParameters} taskParameters параметры для задач
 * @returns {Undertaker.TaskFunction|function(done)} В debug режиме вернёт пустышку, чтобы gulp не упал
 */
function generateTaskForCustomPack(taskParameters) {
   const root = taskParameters.config.rawConfig.output,
      depsTree = new DependencyGraph(),
      results = {
         bundles: {},
         bundlesRoute: {}
      };

   if (!taskParameters.config.isReleaseMode) {
      return function skipCustomPack(done) {
         done();
      };
   }

   const generatePackagesTasks = taskParameters.config.modules.map((moduleInfo) => {
      const moduleOutput = path.join(root, path.basename(moduleInfo.output));
      const input = path.join(moduleOutput, '/**/*.package.json');
      return function custompack() {
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
            .pipe(generatePackageJson(taskParameters, depsTree, results, root));
      };
   });

   return gulp.series(
      generateDepsGraphTask(depsTree, taskParameters.cache),
      gulp.parallel(generatePackagesTasks),
      generateSaveResultsTask(taskParameters.config, results, root)
   );
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
