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
const approvedThemes = require('../../../resources/approved-themes');
const unapprovedThemes = new Set();

/**
 * Parses current theme name. Checks it for new theme name template:
 * <first part> - <second part> - theme.
 * First part - interface module name, that exists in current project
 * Second part - theme name
 * Example: for interface module "Controls" with theme name "online" interface module
 * module would be named to "Controls-online-theme"
 * Returns themeName - current theme name
 * @param{Set} modulesList - current project list of interface modules
 * @param{Array} currentModuleParts - parts of current interface module name
 * @returns {{themeName: string, moduleName: *}}
 */
function parseThemeName(modulesList, currentModuleParts) {
   const themeNameParts = [];
   let interfaceModuleParsed = false;
   while (!interfaceModuleParsed && currentModuleParts.length > 0) {
      themeNameParts.unshift(currentModuleParts.pop());
      if (modulesList.has(currentModuleParts.join('-'))) {
         interfaceModuleParsed = true;
      }
   }

   // remove "theme" postfix from array to get exact theme name
   themeNameParts.pop();
   return themeNameParts.join('-');
}

/**
 * Search theme task initialization
 * @param {TaskParameters} taskParameters a whole list of parameters needed for current project
 * build
 * @returns {Undertaker.TaskFunction}
 */
function generateTaskForMarkThemeModules(taskParameters) {
   // analyse only interface modules supposed to have themes
   const modulesWithThemes = taskParameters.config.modules
      .filter(currentModule => currentModule.name.endsWith('-theme'));
   if (!taskParameters.config.less || modulesWithThemes.length === 0) {
      return function skipMarkThemeModules(done) {
         done();
      };
   }
   const buildModulesNames = new Set();
   taskParameters.config.modules.forEach(
      (currentModule) => {
         if (!currentModule.name.endsWith('-theme')) {
            buildModulesNames.add(path.basename(currentModule.output));
         }
      }
   );
   const tasks = modulesWithThemes.map((moduleInfo) => {
      const input = path.join(moduleInfo.path, '/**/_theme.less');
      return function markThemeModules() {
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
                     const themeName = parseThemeName(buildModulesNames, currentModuleNameParts);

                     // if unapproved theme has already been declared in unapproved themes list,
                     // we don't need to log it then.
                     if (!approvedThemes.has(themeName) && !unapprovedThemes.has(themeName)) {
                        logger.warning({
                           message: `Theme "${themeName}" isn't found in approved themes list. You need to get an approval from Begunov A. for this theme first and then write a task to Kolbeshin F. for updating the list.`,
                           moduleInfo
                        });
                        unapprovedThemes.add(themeName);
                     }
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
