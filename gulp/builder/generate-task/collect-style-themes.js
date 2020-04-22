/**
 * Search of all themes of styles in current project.
 * Themes will be searched and filtered by this template:
 * {Interface Module Name}/themes/{Theme name}/{Theme name}.less
 * Theme name will be set as a name of its folder.
 * @author Kolbeshin F.A.
 */

'use strict';

const gulp = require('gulp');
const path = require('path');
const plumber = require('gulp-plumber');
const mapStream = require('map-stream');
const logger = require('../../../lib/logger').logger();
const startTask = require('../../common/start-task-with-timer');

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
      const input = path.join(moduleInfo.path, '/**/_theme.less');
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
            .pipe(mapStream((file, done) => {
               if (path.basename(file.path) === '_theme.less') {
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
                     moduleInfo.newThemesModule = true;
                  }
               }
               done();
            }));
      };
   });

   const collectStyleThemes = startTask('collectStyleThemes', taskParameters);
   return gulp.series(
      collectStyleThemes.start,
      gulp.parallel(tasks),
      collectStyleThemes.finish
   );
}

module.exports = generateTaskForCollectThemes;
