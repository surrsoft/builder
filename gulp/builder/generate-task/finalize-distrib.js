/**
 * Генерация завершающий задачи для Release сборки. Всё что, нельзя делать инкрементально из-за версионирования.
 * @author Бегунов Ал. В.
 */

'use strict';
const gulp = require('gulp'),
   path = require('path'),
   gulpIf = require('gulp-if'),
   plumber = require('gulp-plumber');

const logger = require('../../../lib/logger').logger(),
   normalizeKey = require('../../../lib/i18n/normalize-key'),
   versionizeFinish = require('../plugins/versionize-finish');

/**
 * Генерация завершающий задачи для Release сборки.
 * @returns {Undertaker.TaskFunction|function(done)} В debug режиме вернёт пустышку, чтобы gulp не упал
 */
function generateTaskForFinalizeDistrib(config) {
   if (!config.isReleaseMode) {
      return function skipFinalizeDistrib(done) {
         done();
      };
   }

   const tasks = [generateTaskForCopyResources(config)];
   if (config.localizations.length > 0) {
      tasks.push(generateTaskForNormalizeKey(config));
   }

   return gulp.series(tasks);
}

function generateTaskForCopyResources(config) {
   const modulesToCopy = config.modulesForPatch.length > 0 ? config.modulesForPatch : config.modules;
   const tasks = modulesToCopy.map((moduleInfo) => {
      const input = path.join(moduleInfo.output, '/**/*.*');

      // необходимо, чтобы мы могли копировать содержимое .builder в output
      const dotInput = path.join(moduleInfo.output, '/.*/*.*');
      const moduleOutput = path.join(config.rawConfig.output, path.basename(moduleInfo.output));
      return function copyResources() {
         return gulp
            .src([input, dotInput], { dot: false, nodir: true })
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
            .pipe(gulpIf(!!config.version, versionizeFinish(moduleInfo)))
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

module.exports = generateTaskForFinalizeDistrib;
