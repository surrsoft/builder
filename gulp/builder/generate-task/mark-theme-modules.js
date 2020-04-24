/**
 * Marks interface modules as themed if there is a _theme.less file
 * in them - it's a definite description of new theme type
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
 * Search theme task initialization
 * @param {TaskParameters} taskParameters a whole list of parameters needed for current project
 * build
 * @returns {Undertaker.TaskFunction}
 */
function generateTaskForMarkThemeModules(taskParameters) {
   if (!taskParameters.config.less) {
      return function skipMarkThemeModules(done) {
         done();
      };
   }
   const tasks = taskParameters.config.modules

      // analyse only interface modules supposed to have themes
      .filter(currentModule => currentModule.name.endsWith('-theme'))
      .map((moduleInfo) => {
         const input = path.join(moduleInfo.path, '/**/_theme.less');
         return function collectStyleThemes() {
            return gulp
               .src(input, { dot: false, nodir: true })
               .pipe(
                  plumber({
                     errorHandler(err) {
                        logger.error({
                           message: 'Task markThemeModules was completed with error',
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
                     if (currentModuleNameParts.length > 2) {
                        moduleInfo.newThemesModule = true;
                     }
                  }
                  done();
               }));
         };
      });

   const collectStyleThemes = startTask('markThemeModules', taskParameters);
   return gulp.series(
      collectStyleThemes.start,
      gulp.parallel(tasks),
      collectStyleThemes.finish
   );
}

module.exports = generateTaskForMarkThemeModules;
