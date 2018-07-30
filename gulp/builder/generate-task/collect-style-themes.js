/**
 * Найти все темы стилей в проекте.
 * Темы при сборке определяются через поиск файла_theme.less по шаблону:
 * {Имя модуля}/themes/{Имя темы}/_theme.less
 * Все less компилируем со всеми темами, которые удалось найти таким образом.
 * Имя темы очевидным образом получаем из пути.
 * @author Бегунов Ал. В.
 */

'use strict';

const gulp = require('gulp'),
   path = require('path'),
   plumber = require('gulp-plumber'),
   mapStream = require('map-stream');

const logger = require('../../../lib/logger').logger();

/**
 * Генерация задачи поиска тем
 * @param {taskParameters} taskParameters кеш сборки статики
 * @param {BuildConfiguration} config конфигурация сборки
 * @returns {Undertaker.TaskFunction}
 */
function generateTaskForCollectThemes(taskParameters, config) {
   const tasks = config.modules.map((moduleInfo) => {
      const input = path.join(moduleInfo.path, '/themes/*/*.less');

      return function collectStyleThemes() {
         return gulp
            .src(input, { dot: false, nodir: true })
            .pipe(
               plumber({
                  errorHandler(err) {
                     logger.error({
                        message: 'Задача collectStyleThemes завершилась с ошибкой',
                        error: err,
                        moduleInfo
                     });
                     this.emit('end');
                  }
               })
            )
            .pipe(mapStream((file, done) => {
               const fileName = path.basename(file.path, '.less');
               const folderName = path.basename(path.dirname(file.path));
               if (fileName === folderName) {
                  taskParameters.cache.addStyleTheme(folderName, path.dirname(file.path));
               }
               done();
            }));
      };
   });

   return gulp.series(
      gulp.parallel(tasks),
      (done) => {
         taskParameters.cache.checkThemesForUpdate();
         done();
      }
   );
}

module.exports = generateTaskForCollectThemes;
