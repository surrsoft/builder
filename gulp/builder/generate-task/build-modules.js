/**
 * Генерация задачи инкрементальной сборки модулей.
 * @author Kolbeshin F.A.
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
   createVersionedModules = require('../plugins/create-versioned-modules'),
   createCdnModules = require('../plugins/create-cdn-modules'),
   indexDictionary = require('../plugins/index-dictionary'),
   localizeXhtml = require('../plugins/localize-xhtml'),
   buildTmpl = require('../plugins/build-tmpl'),
   createContentsJson = require('../plugins/create-contents-json'),
   createLibrariesJson = require('../plugins/create-libraries-json'),
   createStaticTemplatesJson = require('../plugins/create-static-templates-json'),
   createModuleDependenciesJson = require('../plugins/create-module-dependencies-json'),
   copySources = require('../plugins/copy-sources'),
   filterCached = require('../plugins/filter-cached'),
   filterSources = require('../plugins/filter-sources'),
   buildXhtml = require('../plugins/build-xhtml'),
   minifyCss = require('../plugins/minify-css'),
   minifyJs = require('../plugins/minify-js'),
   minifyOther = require('../plugins/minify-other'),
   packOwnDeps = require('../plugins/pack-own-deps'),
   versionizeToStub = require('../plugins/versionize-to-stub');

const logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

const { needSymlink } = require('../../common/helpers');
const startTask = require('../../common/start-task-with-timer');
const { generateDownloadModuleCache, generateSaveModuleCache } = require('../classes/modules-cache');

/**
 * Генерация задачи инкрементальной сборки модулей.
 * @param {TaskParameters} taskParameters параметры для задач
 * @returns {Undertaker.TaskFunction}
 */
function generateTaskForBuildModules(taskParameters) {
   const tasks = [];
   let countCompletedModules = 0;
   const { config } = taskParameters;
   const modulesForPatch = config.getModulesForPatch();
   const modulesForBuild = modulesForPatch.length > 0 ? modulesForPatch : config.modules;
   const printPercentComplete = function(done) {
      countCompletedModules += 1;
      logger.progress(100 * countCompletedModules / modulesForBuild.length);
      done();
   };

   const modulesMap = new Map();
   for (const moduleInfo of config.modules) {
      modulesMap.set(path.basename(moduleInfo.path), moduleInfo.path);
   }

   for (const moduleInfo of modulesForBuild) {
      tasks.push(
         gulp.series(
            generateTaskForBuildSingleModule(taskParameters, moduleInfo, modulesMap),
            printPercentComplete
         )
      );
   }
   const buildModule = startTask('buildModule', taskParameters);
   return gulp.series(
      buildModule.start,
      gulp.parallel(tasks),
      buildModule.finish
   );
}

function generateTaskForBuildSingleModule(taskParameters, moduleInfo, modulesMap) {
   const moduleInput = path.join(moduleInfo.path, '/**/*.*');
   const { config } = taskParameters;
   const hasLocalization = config.localizations.length > 0;
   const needModuleDependencies = config.dependenciesGraph || config.customPack ||
      config.deprecatedStaticHtml || config.minimize || config.checkModuleDependencies;

   const pathsForImportSet = new Set();
   for (const modulePath of modulesMap.values()) {
      pathsForImportSet.add(path.dirname(modulePath));
   }

   /**
    * Воркер не может принимать мапы в качестве аргумента для функции,
    * только объекты.
    * @type {{}}
    */
   const gulpModulesPaths = {};
   for (const currentModuleName of modulesMap.keys()) {
      gulpModulesPaths[currentModuleName] = modulesMap.get(currentModuleName);
   }
   const gulpModulesInfo = {
      pathsForImport: [...pathsForImportSet],
      gulpModulesPaths
   };

   moduleInfo.cachePath = path.join(taskParameters.config.cachePath, 'modules-cache', `${moduleInfo.name}.json`);

   function buildModule() {
      return (
         gulp
            .src(moduleInput, { dot: false, nodir: true })
            .pipe(
               plumber({
                  errorHandler(err) {
                     taskParameters.cache.markCacheAsFailed();
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
            .pipe(gulpIf(config.typescript, compileEsAndTs(taskParameters, moduleInfo)))
            .pipe(addComponentInfo(taskParameters, moduleInfo))

            // compileLess зависит от addComponentInfo. Нужно для сбора темизируемых less.
            .pipe(gulpIf(config.less, compileLess(taskParameters, moduleInfo, gulpModulesInfo)))
            .pipe(gulpIf(config.htmlWml, gulpBuildHtmlTmpl(taskParameters, moduleInfo)))
            .pipe(gulpIf(config.deprecatedWebPageTemplates, buildStaticHtml(taskParameters, moduleInfo, modulesMap)))

            // versionizeToStub зависит от compileLess, buildStaticHtml и gulpBuildHtmlTmpl
            .pipe(gulpIf(!!config.version, versionizeToStub(taskParameters, moduleInfo)))
            .pipe(gulpIf(hasLocalization, indexDictionary(taskParameters, moduleInfo)))
            .pipe(gulpIf(hasLocalization && !moduleInfo.isUnitTestModule, localizeXhtml(taskParameters, moduleInfo)))
            .pipe(
               gulpIf(
                  (hasLocalization || config.wml) && !moduleInfo.isUnitTestModule,
                  buildTmpl(taskParameters, moduleInfo)
               )
            )
            .pipe(
               gulpIf(
                  config.deprecatedXhtml && !moduleInfo.isUnitTestModule,
                  buildXhtml(taskParameters, moduleInfo)
               )
            )
            .pipe(compileJsonToJs(taskParameters, moduleInfo))

            /**
             * packLibrary зависит от addComponentInfo, поскольку нам
             * необходимо правильно записать в кэш информацию о зависимостях
             * запакованной библиотеки, что нужно делать именно после парсинга
             * оригинальной скомпиленной библиотеки.
             * Также в библиотеках нужен кэш шаблонов, чтобы паковать приватные части шаблонов.
             */
            .pipe(gulpIf(config.minimize && !moduleInfo.isUnitTestModule, packLibrary(taskParameters, moduleInfo)))

            // packOwnDeps зависит от buildTmp  l, buildXhtml
            .pipe(gulpIf(config.deprecatedOwnDependencies, packOwnDeps(taskParameters, moduleInfo)))
            .pipe(gulpIf(config.minimize && !moduleInfo.isUnitTestModule, minifyCss(taskParameters, moduleInfo)))

            // minifyJs зависит от packOwnDeps
            .pipe(gulpIf(config.minimize && !moduleInfo.isUnitTestModule, minifyJs(taskParameters, moduleInfo)))
            .pipe(gulpIf(config.minimize && !moduleInfo.isUnitTestModule, minifyOther(taskParameters, moduleInfo)))

            // createVersionedModules и createCdnModules зависит от versionizeToStub
            .pipe(gulpIf(!!config.version, createVersionedModules(taskParameters, moduleInfo)))
            .pipe(gulpIf(!!config.version, createCdnModules(taskParameters, moduleInfo)))
            .pipe(
               gulpRename((file) => {
                  file.dirname = transliterate(file.dirname);
                  file.basename = transliterate(file.basename);
               })
            )
            .pipe(gulpIf(config.presentationServiceMeta, createRoutesInfoJson(taskParameters, moduleInfo)))
            .pipe(gulpIf(config.presentationServiceMeta, createNavigationModulesJson(taskParameters, moduleInfo)))

            // createContentsJson зависит от buildStaticHtml и addComponentInfo
            .pipe(gulpIf(config.contents, createContentsJson(taskParameters, moduleInfo)))
            .pipe(gulpIf(config.customPack, createLibrariesJson(taskParameters, moduleInfo)))

            // createStaticTemplatesJson зависит от buildStaticHtml и gulpBuildHtmlTmpl
            .pipe(gulpIf(config.presentationServiceMeta, createStaticTemplatesJson(taskParameters, moduleInfo)))
            .pipe(gulpIf(needModuleDependencies, createModuleDependenciesJson(taskParameters, moduleInfo)))
            .pipe(filterCached())
            .pipe(gulpIf(config.isSourcesOutput, filterSources()))
            .pipe(gulpIf(!config.sources, copySources(taskParameters, moduleInfo)))
            .pipe(gulpChmod({ read: true, write: true }))
            .pipe(
               gulpIf(
                  needSymlink(config, moduleInfo),
                  gulp.symlink(moduleInfo.output),
                  gulp.dest(moduleInfo.output)
               )
            )
      );
   }

   return gulp.series(
      generateDownloadModuleCache(taskParameters, moduleInfo),
      buildModule,
      generateSaveModuleCache(moduleInfo),
   );
}

module.exports = generateTaskForBuildModules;
