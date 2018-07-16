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
   filterUnused = require('../plugins/filter-unused'),
   buildXhtml = require('../plugins/build-xhtml'),
   minifyCss = require('../plugins/minify-css'),
   minifyJs = require('../plugins/minify-js'),
   minifyOther = require('../plugins/minify-other'),
   packOwnDeps = require('../plugins/pack-own-deps'),
   versionizeToStub = require('../plugins/versionize-to-stub'),
   createPreloadUrlsJson = require('../plugins/create-preload-urls-json');

const logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

const { needSymlink } = require('../helpers');

/**
 * Генерация задачи инкрементальной сборки модулей.
 * @param {ChangesStore} changesStore кеш
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {Pool} pool пул воркеров
 * @returns {Undertaker.TaskFunction}
 */
function generateTaskForBuildModules(changesStore, config, pool) {
   const tasks = [];
   let countCompletedModules = 0;

   const printPercentComplete = function(done) {
      countCompletedModules += 1;
      logger.progress(100 * countCompletedModules / config.modules.length);
      done();
   };

   const modulesMap = new Map();
   for (const moduleInfo of config.modules) {
      modulesMap.set(path.basename(moduleInfo.path), moduleInfo.path);
   }

   for (const moduleInfo of config.modules) {
      tasks.push(
         gulp.series(
            generateTaskForBuildSingleModule(config, changesStore, moduleInfo, pool, modulesMap),
            printPercentComplete
         )
      );
   }
   return gulp.parallel(tasks);
}

function generateTaskForBuildSingleModule(config, changesStore, moduleInfo, pool, modulesMap) {
   const moduleInput = path.join(moduleInfo.path, '/**/*.*');
   let sbis3ControlsPath = '';
   if (modulesMap.has('SBIS3.CONTROLS')) {
      sbis3ControlsPath = modulesMap.get('SBIS3.CONTROLS');
   }
   const hasLocalization = config.localizations.length > 0;

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
            .pipe(changedInPlace(changesStore, moduleInfo))
            .pipe(compileEsAndTs(changesStore, moduleInfo, pool))
            .pipe(compileJsonToJs(changesStore, moduleInfo))
            .pipe(compileLess(changesStore, moduleInfo, pool, sbis3ControlsPath, pathsForImport))
            .pipe(addComponentInfo(changesStore, moduleInfo, pool))
            .pipe(gulpBuildHtmlTmpl(config, changesStore, moduleInfo, pool))
            .pipe(buildStaticHtml(config, changesStore, moduleInfo, modulesMap))

            // versionizeToStub зависит от compileLess, buildStaticHtml и gulpBuildHtmlTmpl
            .pipe(gulpIf(!!config.version, versionizeToStub(config, changesStore, moduleInfo)))
            .pipe(gulpIf(hasLocalization, indexDictionary(config, moduleInfo)))
            .pipe(gulpIf(hasLocalization, localizeXhtml(config, changesStore, moduleInfo, pool)))
            .pipe(gulpIf(hasLocalization || config.isReleaseMode, buildTmpl(config, changesStore, moduleInfo, pool)))
            .pipe(gulpIf(config.isReleaseMode, buildXhtml(changesStore, moduleInfo, pool)))

            // packOwnDeps зависит от buildTmpl и buildXhtml
            .pipe(gulpIf(config.isReleaseMode, packOwnDeps(changesStore, moduleInfo)))
            .pipe(gulpIf(config.isReleaseMode, minifyCss(changesStore, moduleInfo, pool)))

            // minifyJs зависит от packOwnDeps
            .pipe(gulpIf(config.isReleaseMode, minifyJs(changesStore, moduleInfo, pool)))
            .pipe(gulpIf(config.isReleaseMode, minifyOther(changesStore, moduleInfo)))
            .pipe(
               gulpRename((file) => {
                  file.dirname = transliterate(file.dirname);
                  file.basename = transliterate(file.basename);
               })
            )
            .pipe(createRoutesInfoJson(changesStore, moduleInfo, pool))
            .pipe(createNavigationModulesJson(moduleInfo))

            // createContentsJson зависит от buildStaticHtml и addComponentInfo
            .pipe(createContentsJson(config, moduleInfo))

            // createStaticTemplatesJson зависит от buildStaticHtml и gulpBuildHtmlTmpl
            .pipe(createStaticTemplatesJson(moduleInfo))
            .pipe(gulpIf(config.isReleaseMode, createModuleDependenciesJson(changesStore, moduleInfo)))
            .pipe(gulpIf(config.isReleaseMode, createPreloadUrlsJson(moduleInfo)))
            .pipe(filterCached())
            .pipe(filterUnused())
            .pipe(gulpChmod({ read: true, write: true }))
            .pipe(
               gulpIf(
                  needSymlink(config, moduleInfo),
                  gulp.symlink(moduleInfo.output),
                  gulp.dest(moduleInfo.output)
               )
            )
      );
   };
}

module.exports = generateTaskForBuildModules;
