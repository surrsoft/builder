'use strict';
const gulp = require('gulp'),
   path = require('path'),
   plumber = require('gulp-plumber');

const logger = require('../../../lib/logger').logger(),
   pluginPackHtml = require('../plugins/pack-html');

function generateTaskForPackHtml(config, pool) {
   if (!config.isReleaseMode) {
      return function skipPackHtml(done) {
         done();
      };
   }

   const tasks = config.modules.map((moduleInfo) => {
      const moduleOutput = path.join(config.rawConfig.output, path.basename(moduleInfo.output));

      // интересны именно файлы на первом уровне вложенности в модулях
      const input = path.join(moduleOutput, '/*.html');

      return function packHtml() {
         return gulp
            .src(input, { dot: false, nodir: true })
            .pipe(
               plumber({
                  errorHandler(err) {
                     logger.error({
                        message: 'Задача packHtml завершилась с ошибкой',
                        error: err,
                        moduleInfo
                     });
                     this.emit('end');
                  }
               })
            )
            .pipe(pluginPackHtml(config, moduleInfo, pool))
            .pipe(gulp.dest(moduleOutput));
      };
   });

   return gulp.parallel(tasks);
}

module.exports = generateTaskForPackHtml;
