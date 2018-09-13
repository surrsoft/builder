/**
 * Найти все кастомные пакеты в проекте.
 * Кастомные пакеты определяются по файлу формата
 * <packageName>.package.json
 * @author Колбешин Ф.А.
 */

'use strict';

const gulp = require('gulp'),
   path = require('path'),
   plumber = require('gulp-plumber'),
   packHelpers = require('../../../lib/pack/helpers/custompack'),
   mapStream = require('map-stream'),
   collectCustomPacks = require('../plugins/collect-custom-packs');

const logger = require('../../../lib/logger').logger();

/**
 * Генерация задачи поиска тем
 * @param {TaskParameters} taskParameters кеш сборки статики
 * @param {BuildConfiguration} config конфигурация сборки
 * @returns {Undertaker.TaskFunction}
 */
function generateCollectPackagesTasks(taskParameters, config) {
   const root = taskParameters.config.rawConfig.output;
   taskParameters.config.customPackages = [];
   const tasks = config.modules.map((moduleInfo) => {
      const input = path.join(moduleInfo.path, '/**/*.package.json');
      return function collectPackageJson() {
         return gulp
            .src(input, { dot: false, nodir: true })
            .pipe(
               plumber({
                  errorHandler(err) {
                     logger.error({
                        message: 'Задача collectPackageJson завершилась с ошибкой',
                        error: err,
                        moduleInfo
                     });
                     this.emit('end');
                  }
               })
            )
            .pipe(collectCustomPacks(taskParameters, moduleInfo, root));
      };
   });
   return gulp.parallel(tasks);
}

module.exports = generateCollectPackagesTasks;
