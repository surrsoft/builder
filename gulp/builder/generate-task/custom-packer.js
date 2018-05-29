'use strict';
const gulp = require('gulp'),
   path = require('path'),
   generatePackageJson = require('../plugins/custom-packer'),
   saveCustomPackResults = require('../../../lib/pack/custom-packer').saveCustomPackResults;

function generateTaskForCustomPack(config) {
   const
      applicationRoot = config.rawConfig.output,
      results = {};

   if (!config.isReleaseMode) {
      return function skipCustomPack(done) {
         done();
      };
   }

   const generatePackagesFromFileConfigTasks = config.modules.map((moduleInfo) => {
      const moduleOutput = path.join(applicationRoot, path.basename(moduleInfo.output));
      const input = path.join(moduleOutput, '/**/*.package.json');
      return function custompack() {
         return gulp
            .src(input, {dot: false, nodir: true})
            .pipe(generatePackageJson(results))
            .pipe(gulp.dest(moduleOutput));
      }
   });

   return gulp.series(
      gulp.parallel(generatePackagesFromFileConfigTasks),
      saveCustomPackResults(results, applicationRoot, true)
   );
}

module.exports = generateTaskForCustomPack;
