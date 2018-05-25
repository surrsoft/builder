'use strict';
const gulp = require('gulp'),
   path = require('path'),
   gulpIf = require('gulp-if'),
   plumber = require('gulp-plumber');

const logger = require('../../../lib/logger').logger(),
   normalizeKey = require('../../../lib/i18n/normalize-key'),
   packHtml = require('../plugins/pack-html'),
   gzip = require('../plugins/gzip'),
   versionizeFinish = require('../plugins/versionize-finish');

function generateTaskForCopyResources(config, pool) {
   const tasks = config.modules.map((moduleInfo) => {
      const input = path.join(moduleInfo.output, '/**/*.*');
      const moduleOutput = path.join(config.rawConfig.output, path.basename(moduleInfo.output));
      return function copyResources() {
         return gulp
            .src(input, { dot: false, nodir: true })
            .pipe(
               plumber({
                  errorHandler(err) {
                     logger.error({
                        message: 'Задача copyResources завершилась с ошибкой',
                        error: err,
                        moduleInfo
                     });
                     this.emit('end');
                  }
               })
            )
            .pipe(gulpIf(!!config.version, versionizeFinish(config, moduleInfo)))
            .pipe(packHtml(moduleInfo, pool))
            .pipe(gzip(moduleInfo, pool))
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
            message: "Ошибка Builder'а",
            error: e
         });
      }
   };
}

function generateTaskForFinalizeDistrib(config, pool, localizationEnable) {
   if (!config.isReleaseMode) {
      return function skipFinalizeDistrib(done) {
         done();
      };
   }

   const tasks = [generateTaskForCopyResources(config, pool)];
   if (localizationEnable) {
      tasks.push(generateTaskForNormalizeKey(config));
   }

   return gulp.series(tasks);
}

module.exports = generateTaskForFinalizeDistrib;
