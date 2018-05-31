'use strict';
const gulp = require('gulp'),
   path = require('path'),
   generatePackageJson = require('../plugins/custom-packer'),
   getModuleMDeps = require('../plugins/read-module-mdeps'),
   logger = require('../../../lib/logger').logger(),
   DependencyGraph = require('../../../packer/lib/dependencyGraph'),
   plumber = require('gulp-plumber'),
   { saveCustomPackResults } = require('../../../lib/pack/custom-packer');

function generateSaveResultsTask(config, results, applicationRoot, splittedCore) {
   return function saveCustomPackerResults() {
      results.bundlesJson = results.bundles;
      return saveCustomPackResults(results, applicationRoot, splittedCore, true);
   };
}

function generateTaskForCustomPack(config) {
   const
      applicationRoot = config.rawConfig.output,
      splittedCore = true,
      depsTree = new DependencyGraph(),
      results = {
         bundles: {},
         bundlesRoute: {}
      };

   if (!config.isReleaseMode) {
      return function skipCustomPack(done) {
         done();
      };
   }

   const getMDepsTasks = config.modules.map((moduleInfo) => {
      const moduleOutput = path.join(applicationRoot, path.basename(moduleInfo.output));
      const input = path.join(moduleOutput, 'module-dependencies.json');
      return function getModuleDeps() {
         return gulp
            .src(input, {dot: false, nodir: true})
            .pipe(getModuleMDeps(depsTree))
            .pipe(
               plumber({
                  errorHandler(err) {
                     logger.error({
                        message: 'Задача getModuleDeps завершилась с ошибкой',
                        error: err,
                        moduleInfo
                     });
                     this.emit('end');
                  }
               })
            );
      };
   });

   const generatePackagesTasks = config.modules.map((moduleInfo) => {
      const moduleOutput = path.join(applicationRoot, path.basename(moduleInfo.output));
      logger.info(moduleOutput);
      const input = path.join(moduleOutput, '/**/*.package.json');
      return function custompack() {
         return gulp
            .src(input, {dot: false, nodir: true})
            .pipe(generatePackageJson(depsTree, results, applicationRoot, splittedCore))
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
            );
      };
   });

   return gulp.series(
      gulp.parallel(getMDepsTasks),
      gulp.parallel(generatePackagesTasks),
      generateSaveResultsTask(config, results, applicationRoot, splittedCore)
   );
}

module.exports = generateTaskForCustomPack;
