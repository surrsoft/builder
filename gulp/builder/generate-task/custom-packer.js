'use strict';
const gulp = require('gulp'),
   path = require('path'),
   generatePackageJson = require('../plugins/custom-packer'),
   getModuleMDeps = require('../plugins/read-module-mdeps'),
   saveCustomPackResults = require('../../../lib/pack/custom-packer').saveCustomPackResults,
   logger = require('../../../lib/logger').logger(),
   gulpIf = require('gulp-if'),
   DependencyGraph = require('../../../packer/lib/dependencyGraph');

function testFunction(results) {
   const test = results;
   debugger;
}
function saveResults(results, applicationRoot, moduleInfo) {
   const moduleOutput = path.join(applicationRoot, path.basename(moduleInfo.output));
   const input = path.join(moduleOutput, '/**/*.package.json');
   return function test() {
      return gulp
         .src(input, {dot: false, nodir: true})
         .pipe(testFunction(results))
         .pipe(gulp.dest(moduleOutput));
   }
}

function generateTaskForCustomPack(config) {
   const
      applicationRoot = config.rawConfig.output,
      splittedCore = true,
      depsTree = new DependencyGraph(),
      results = {};

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
            .pipe(getModuleMDeps(depsTree));
      };
   });

   const generatePackagesTasks = config.modules.map((moduleInfo) => {
      const moduleOutput = path.join(applicationRoot, path.basename(moduleInfo.output));
      logger.info(moduleOutput);
      const input = path.join(moduleOutput, '/**/*.package.json');
      return function custompack() {
         return gulp
            .src(input, {dot: false, nodir: true})
            .pipe(gulpIf(moduleOutput.split(/\/|\\/).pop().includes('Controls'), generatePackageJson(depsTree, results, applicationRoot, splittedCore)));
      };
   });

   return gulp.series(
      gulp.parallel(getMDepsTasks),
      gulp.parallel(generatePackagesTasks),
      saveResults(results, applicationRoot, config.modules[0])
   );
}

module.exports = generateTaskForCustomPack;
