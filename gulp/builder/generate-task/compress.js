/**
 * Генерация задачи архивации для файлов
 * @author Бегунов Ал. В.
 */

'use strict';

const gulp = require('gulp'),
   path = require('path'),
   plumber = require('gulp-plumber');

const compressPlugin = require('../plugins/compress'),
   logger = require('../../../lib/logger').logger();

/**
 * Генерация задачи архивации для файлов
 * @param {TaskParameters} taskParameters параметры для задач
 * @returns {Undertaker.TaskFunction|function(done)} В debug режиме вернёт пустышку, чтобы gulp не упал
 */
function generateTaskForCompress(taskParameters) {
   if (!taskParameters.config.compress) {
      return function skipCompress(done) {
         done();
      };
   }

   const tasks = taskParameters.config.modules.map((moduleInfo) => {
      const moduleOutput = path.join(taskParameters.config.rawConfig.output, path.basename(moduleInfo.output));

      // generate compressed resources only for minified content and fonts.
      const input = path.join(moduleOutput, '/**/*.+(min.*|woff2|woff|eot)');

      return function compress() {
         return gulp
            .src(input, { dot: false, nodir: true })
            .pipe(
               plumber({
                  errorHandler(err) {
                     logger.error({
                        message: 'Задача compress завершилась с ошибкой',
                        error: err,
                        moduleInfo
                     });
                     this.emit('end');
                  }
               })
            )
            .pipe(compressPlugin(taskParameters, moduleInfo))
            .pipe(gulp.dest(moduleOutput));
      };
   });

   return gulp.parallel(tasks);
}

module.exports = generateTaskForCompress;
