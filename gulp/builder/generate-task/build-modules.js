/**
 * Генерация задачи инкрементальной сборки модулей.
 * @author Бегунов Ал. В.
 */

'use strict';

const path = require('path'),
   gulp = require('gulp'),
   gulpRename = require('gulp-rename'),
   gulpChmod = require('gulp-chmod'),
   plumber = require('gulp-plumber'),
   gulpIf = require('gulp-if');

// наши плагины
const gulpBuildHtmlTmpl = require('../plugins/build-html-tmpl'),
   compileEsAndTs = require('../plugins/compile-es-and-ts'),
   packLibrary = require('../plugins/pack-library'),
   compileJsonToJs = require('../plugins/compile-json-js'),
   compileLess = require('../plugins/compile-less'),
   changedInPlace = require('../../common/plugins/changed-in-place'),
   addComponentInfo = require('../plugins/add-component-info'),
   buildStaticHtml = require('../plugins/build-static-html'),
   createRoutesInfoJson = require('../plugins/create-routes-info-json'),
   createNavigationModulesJson = require('../plugins/create-navigation-modules-json'),
   indexDictionary = require('../plugins/index-dictionary'),
   localizeXhtml = require('../plugins/localize-xhtml'),
   buildTmpl = require('../plugins/build-tmpl'),
   createContentsJson = require('../plugins/create-contents-json'),
   createStaticTemplatesJson = require('../plugins/create-static-templates-json'),
   createModuleDependenciesJson = require('../plugins/create-module-dependencies-json'),
   filterCached = require('../plugins/filter-cached'),
   filterSources = require('../plugins/filter-sources'),
   buildXhtml = require('../plugins/build-xhtml'),
   minifyCss = require('../plugins/minify-css'),
   minifyJs = require('../plugins/minify-js'),
   minifyOther = require('../plugins/minify-other'),
   packOwnDeps = require('../plugins/pack-own-deps'),
   versionizeToStub = require('../plugins/versionize-to-stub'),
   createPreloadUrlsJson = require('../plugins/create-preload-urls-json');

const logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

const { needSymlink } = require('../../common/helpers');

/**
 * Генерация задачи инкрементальной сборки модулей.
 * @param {TaskParameters} taskParameters параметры для задач
 * @returns {Undertaker.TaskFunction}
 */
function generateTaskForBuildModules(taskParameters) {
   const tasks = [];
   let countCompletedModules = 0;

   const printPercentComplete = function(done) {
      countCompletedModules += 1;
      logger.progress(100 * countCompletedModules / taskParameters.config.modules.length);
      done();
   };

   const modulesMap = new Map();
   for (const moduleInfo of taskParameters.config.modules) {
      modulesMap.set(path.basename(moduleInfo.path), moduleInfo.path);
   }

   for (const moduleInfo of taskParameters.config.modules) {
      tasks.push(
         gulp.series(
            generateTaskForBuildSingleModule(taskParameters, moduleInfo, modulesMap),
            printPercentComplete
         )
      );
   }
   return gulp.parallel(tasks);
}

function generateTaskForBuildSingleModule(taskParameters, moduleInfo, modulesMap) {
   const moduleInput = path.join(moduleInfo.path, '/**/*.*');
   let sbis3ControlsPath = '';
   if (modulesMap.has('SBIS3.CONTROLS')) {
      sbis3ControlsPath = modulesMap.get('SBIS3.CONTROLS');
   }
   const { isReleaseMode } = taskParameters.config;
   const hasLocalization = taskParameters.config.localizations.length > 0;

   const pathsForImportSet = new Set();
   for (const modulePath of modulesMap.values()) {
      pathsForImportSet.add(path.dirname(modulePath));
   }
   const pathsForImport = [...pathsForImportSet];

   return function buildModule() {
      return (
         gulp
            .src(moduleInput, { dot: false, nodir: true })
            .pipe(
               plumber({
                  errorHandler(err) {
                     logger.error({
                        message: 'Задача buildModule завершилась с ошибкой',
                        error: err,
                        moduleInfo
                     });
                     this.emit('end');
                  }
               })
            )
            .pipe(changedInPlace(taskParameters, moduleInfo))
            .pipe(compileEsAndTs(taskParameters, moduleInfo))
            .pipe(gulpIf(isReleaseMode, packLibrary(taskParameters, moduleInfo)))
            .pipe(compileJsonToJs(taskParameters, moduleInfo))
            .pipe(addComponentInfo(taskParameters, moduleInfo))

            // compileLess зависит от addComponentInfo. Нужно для сбора темизируемых less.
            .pipe(compileLess(taskParameters, moduleInfo, sbis3ControlsPath, pathsForImport))
            .pipe(
               gulpIf(
                  taskParameters.config.needTemplates,
                  gulpBuildHtmlTmpl(taskParameters, moduleInfo)
               )
            )
            .pipe(
               gulpIf(
                  taskParameters.config.needTemplates,
                  buildStaticHtml(taskParameters, moduleInfo, modulesMap)
               )
            )

            // versionizeToStub зависит от compileLess, buildStaticHtml и gulpBuildHtmlTmpl
            .pipe(gulpIf(!!taskParameters.config.version, versionizeToStub(taskParameters, moduleInfo)))
            .pipe(gulpIf(hasLocalization, indexDictionary(taskParameters, moduleInfo)))
            .pipe(gulpIf(hasLocalization, localizeXhtml(taskParameters, moduleInfo)))
            .pipe(gulpIf(hasLocalization || isReleaseMode, buildTmpl(taskParameters, moduleInfo)))
            .pipe(gulpIf(isReleaseMode, buildXhtml(taskParameters, moduleInfo)))

            // packOwnDeps зависит от buildTmpl и buildXhtml
            .pipe(gulpIf(isReleaseMode, packOwnDeps(taskParameters, moduleInfo)))
            .pipe(gulpIf(isReleaseMode, minifyCss(taskParameters, moduleInfo)))

            // minifyJs зависит от packOwnDeps
            .pipe(gulpIf(isReleaseMode, minifyJs(taskParameters, moduleInfo)))
            .pipe(gulpIf(isReleaseMode, minifyOther(taskParameters, moduleInfo)))
            .pipe(
               gulpRename((file) => {
                  file.dirname = transliterate(file.dirname);
                  file.basename = transliterate(file.basename);
               })
            )
            .pipe(createRoutesInfoJson(taskParameters, moduleInfo))
            .pipe(createNavigationModulesJson(moduleInfo))

            // createContentsJson зависит от buildStaticHtml и addComponentInfo
            .pipe(createContentsJson(taskParameters, moduleInfo))

            // createStaticTemplatesJson зависит от buildStaticHtml и gulpBuildHtmlTmpl
            .pipe(createStaticTemplatesJson(moduleInfo))
            .pipe(gulpIf(isReleaseMode, createModuleDependenciesJson(taskParameters, moduleInfo)))
            .pipe(gulpIf(isReleaseMode, createPreloadUrlsJson(moduleInfo)))
            .pipe(filterCached())
            .pipe(gulpIf(taskParameters.config.isSourcesOutput, filterSources()))
            .pipe(gulpChmod({ read: true, write: true }))
            .pipe(
               gulpIf(
                  needSymlink(taskParameters.config, moduleInfo),
                  gulp.symlink(moduleInfo.output),
                  gulp.dest(moduleInfo.output)
               )
            )
      );
   };
}

module.exports = generateTaskForBuildModules;
