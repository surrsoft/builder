'use strict';
const gulp = require('gulp'),
   path = require('path');

const logger = require('../../../lib/logger').logger(),
   normalizeKey = require('../../../lib/i18n/normalize-key');

function generateTaskForCopyResources(config) {
   const input = path.join(config.outputPath, '/**/*.*');
   return function copyResources() {
      return gulp.src(input, { dot: false, nodir: true }).pipe(gulp.dest(config.rawConfig.output));
   };
}

function generateTaskForNormalizeKey(config) {
   return async function normalizeKeyTask(done) {
      try {
         await normalizeKey(config.rawConfig.output, config.localizations);
         done();
      } catch (e) {
         logger.error({
            message: "Ошибка Builder'а",
            error: e
         });
      }
   };
}

function generateTaskForFinalizeDistrib(config, localizationEnable) {
   if (!config.version) {
      return function skipFinalizeDistrib(done) {
         done();
      };
   }

   const tasks = [generateTaskForCopyResources(config)];
   if (localizationEnable) {
      tasks.push(generateTaskForNormalizeKey(config));
   }

   return gulp.series(tasks);
}

module.exports = generateTaskForFinalizeDistrib;
