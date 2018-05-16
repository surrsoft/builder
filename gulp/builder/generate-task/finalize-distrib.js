'use strict';
const gulp = require('gulp'),
   path = require('path'),
   plumber = require('gulp-plumber');

const logger = require('../../../lib/logger').logger(),
   normalizeKey = require('../../../lib/i18n/normalize-key'),
   versionizeFinish = require('../plugins/versionize-finish');

function generateTaskForCopyResources(config) {
   const tasks = config.modules.map(moduleInfo => {
      const input = path.join(moduleInfo.output, '/**/*.*');
      const moduleOutput = path.join(config.rawConfig.output, path.basename(moduleInfo.output));
      return function copyResources() {
         return gulp.src(input, {dot: false, nodir: true})
            .pipe(plumber({
               errorHandler: function(err) {
                  logger.error({
                     message: 'Задача copyResources завершилась с ошибкой',
                     error: err,
                     moduleInfo: moduleInfo
                  });
                  this.emit('end');
               }
            }))
            .pipe(versionizeFinish(config, moduleInfo))
            .pipe(gulp.dest(moduleOutput));
      };
   });

   return gulp.parallel(tasks);
}

function generateTaskForNormalizeKey(config) {
   return async function normalizeKeyTask(done) {
      try {
         await normalizeKey(config.rawConfig.output, config.localizations);
         done();
      } catch (e) {
         logger.error({
            message: 'Ошибка Builder\'а',
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
