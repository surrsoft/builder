/**
 * Найти все темы стилей в проекте.
 * Темы при сборке определяются через поиск файла по шаблону:
 * {Имя модуля}/themes/{Имя темы}/<Имя темы>.less
 * Все less компилируем со всеми темами, которые удалось найти таким образом,
 * кроме less для разных локалей и внутри папки темы.
 * Имя темы очевидным образом получаем из пути.
 * @author Бегунов Ал. В.
 */

'use strict';

const gulp = require('gulp'),
   path = require('path'),
   plumber = require('gulp-plumber'),
   mapStream = require('map-stream'),
   fs = require('fs-extra'),
   configLessChecker = require('../../../lib/config-less-checker');

const logger = require('../../../lib/logger').logger();

/**
 * Генерация задачи поиска тем
 * @param {TaskParameters} taskParameters кеш сборки статики
 * @param {BuildConfiguration} config конфигурация сборки
 * @returns {Undertaker.TaskFunction}
 */
function generateTaskForCollectThemes(taskParameters, config) {
   if (!taskParameters.config.less) {
      return function skipCollectStyleThemes(done) {
         done();
      };
   }
   const tasks = config.modules.map((moduleInfo) => {
      const input = [
         path.join(moduleInfo.path, '/themes/*/*.less'),
         path.join(moduleInfo.path, '/themes.config.json')
      ];
      return function collectStyleThemes() {
         return gulp
            .src(input, { dot: false, nodir: true, allowEmpty: true })
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
            .pipe(mapStream(async(file, done) => {
               if (path.basename(file.path) === 'themes.config.json') {
                  try {
                     const parsedLessConfig = JSON.parse(file.contents);
                     configLessChecker.checkOptions(parsedLessConfig);
                     taskParameters.cache.addModuleLessConfiguration(moduleInfo.name, parsedLessConfig);
                  } catch (error) {
                     logger.error({
                        message: 'Ошибка обработки файла конфигурации less для Интерфейсного модуля',
                        error,
                        filePath: file.path,
                        moduleInfo
                     });
                  }
               } else {
                  const fileName = path.basename(file.path, '.less');
                  const folderName = path.basename(path.dirname(file.path));
                  if (fileName === folderName) {
                     const themeConfigPath = `${path.dirname(file.path)}/theme.config.json`;
                     let themeConfig;
                     if (!(await fs.pathExists(themeConfigPath))) {
                        logger.warning(`Для темы ${file.path} не задан файл конфигурации ${themeConfigPath}` +
                           ' с набором тегов совместимости. Данная тема билдиться не будет.');
                     } else {
                        try {
                           themeConfig = await fs.readJson(themeConfigPath);
                        } catch (error) {
                           logger.error({
                              message: 'Ошибка чтения конфигурации темы. Проверьте правильность описания файла конфигугации',
                              error,
                              filePath: themeConfigPath,
                              moduleInfo
                           });
                        }
                     }
                     taskParameters.cache.addStyleTheme(folderName, path.dirname(file.path), themeConfig);
                  }
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
