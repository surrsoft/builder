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
 * Parses current interface module name. Checks it for new theme name template:
 * <first part> - <second part> - theme.
 * First part - interface module name, that exists in current project
 * Second part - theme name
 * Example: for interface module "Controls" with theme name "online" interface module
 * for this theme would be named to "Controls-online-theme"
 * Returns base theme info:
 * 1)moduleName - interface module name for current theme
 * 2)themeName - current theme name
 * @param{Set} modulesList - current project list of interface modules
 * @param{Array} currentModuleParts - parts of current interface module name
 * @returns {{themeName: string, moduleName: *}}
 */
function parseCurrentModuleName(modulesList, currentModuleParts) {
   const themeNameParts = [];
   let interfaceModuleParsed = false;
   while (!interfaceModuleParsed && currentModuleParts.length > 0) {
      themeNameParts.unshift(currentModuleParts.pop());
      if (modulesList.has(currentModuleParts.join('-'))) {
         interfaceModuleParsed = true;
      }
   }
   return {
      moduleName: currentModuleParts.join('-'),
      themeName: themeNameParts.join('-')
   };
}

/**
 * Генерация задачи поиска тем
 * @param {TaskParameters} taskParameters кеш сборки статики
 * @returns {Undertaker.TaskFunction}
 */
function generateTaskForCollectThemes(taskParameters) {
   if (!taskParameters.config.less) {
      return function skipCollectStyleThemes(done) {
         done();
      };
   }
   const buildModulesNames = new Set();
   taskParameters.config.modules.forEach(
      currentModule => buildModulesNames.add(path.basename(currentModule.output))
   );
   const tasks = taskParameters.config.modules.map((moduleInfo) => {
      const input = [
         path.join(moduleInfo.path, '/themes/*/*.less'),
         path.join(moduleInfo.path, '/themes.config.json'),
         path.join(moduleInfo.path, '_theme.less')
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
               const currentFileName = path.basename(file.path);
               const folderName = path.basename(path.dirname(file.path));
               if (currentFileName === 'themes.config.json') {
                  try {
                     const parsedLessConfig = JSON.parse(file.contents);
                     configLessChecker.checkOptions(parsedLessConfig);

                     // disable old less in less config if disabled for all project
                     if (!taskParameters.config.oldThemes) {
                        parsedLessConfig.old = false;
                     }
                     taskParameters.cache.addModuleLessConfiguration(moduleInfo.name, parsedLessConfig);
                  } catch (error) {
                     logger.error({
                        message: 'Ошибка обработки файла конфигурации less для Интерфейсного модуля',
                        error,
                        filePath: file.path,
                        moduleInfo
                     });
                  }
               } else if (currentFileName === '_theme.less') {
                  const currentModuleName = path.basename(moduleInfo.output);
                  const currentModuleNameParts = currentModuleName.split('-');

                  /**
                   * Interface module name for new theme should always contains 3 parts:
                   * 1)Interface module name for current theme
                   * 2)Current theme name
                   * 3) "theme" postfix
                   * Other Interface modules will be ignored from new theme's processing
                   */
                  if (currentModuleNameParts.length > 2 && currentModuleNameParts.pop() === 'theme') {
                     const result = parseCurrentModuleName(buildModulesNames, currentModuleNameParts);
                     taskParameters.cache.addNewStyleTheme(folderName, result);
                  }
               } else {
                  const fileName = path.basename(file.path, '.less');
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

module.exports = {
   generateTaskForCollectThemes,
   parseCurrentModuleName
};
