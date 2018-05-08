'use strict';

const path = require('path'),
   gulp = require('gulp'),
   gulpRename = require('gulp-rename'),
   gulpChmod = require('gulp-chmod'),
   plumber = require('gulp-plumber'),
   gulpIf = require('gulp-if');

//наши плагины
const gulpBuildHtmlTmpl = require('../plugins/build-html-tmpl'),
   compileLess = require('../plugins/compile-less'),
   changedInPlace = require('../../helpers/plugins/changed-in-place'),
   addComponentInfo = require('../plugins/add-component-info'),
   buildStaticHtml = require('../plugins/build-static-html'),
   createRoutesInfoJson = require('../plugins/create-routes-info-json'),
   indexDictionary = require('../plugins/index-dictionary'),
   localizeXhtml = require('../plugins/localize-xhtml'),
   buildTmpl = require('../plugins/build-tmpl'),
   createContentsJson = require('../plugins/create-contents-json'),
   createStaticTemplatesJson = require('../plugins/create-static-templates-json'),
   filterCached = require('../plugins/filter-cached');

const logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

function generateTaskForBuildSingleModule(config, changesStore, moduleInfo, pool, modulesMap) {
   const moduleInput = path.join(moduleInfo.path, '/**/*.*');
   let sbis3ControlsPath = '';
   if (modulesMap.has('SBIS3.CONTROLS')) {
      sbis3ControlsPath = modulesMap.get('SBIS3.CONTROLS');
   }
   const hasLocalization = config.localizations.length > 0;
   return function buildModule() {
      return gulp
         .src(moduleInput, { dot: false, nodir: true })
         .pipe(
            plumber({
               errorHandler: function(err) {
                  logger.error({
                     message: 'Задача buildModule завершилась с ошибкой',
                     error: err,
                     moduleInfo: moduleInfo
                  });
                  this.emit('end');
               }
            })
         )
         .pipe(changedInPlace(changesStore, moduleInfo))
         .pipe(compileLess(changesStore, moduleInfo, pool, sbis3ControlsPath))
         .pipe(addComponentInfo(changesStore, moduleInfo, pool))
         .pipe(gulpBuildHtmlTmpl(config, changesStore, moduleInfo, pool))
         .pipe(buildStaticHtml(changesStore, moduleInfo, modulesMap))
         .pipe(gulpIf(hasLocalization || config.isReleaseMode, buildTmpl(config, changesStore, moduleInfo, pool)))
         .pipe(
            gulpRename(file => {
               file.dirname = transliterate(file.dirname);
               file.basename = transliterate(file.basename);
            })
         )
         .pipe(gulpIf(hasLocalization, indexDictionary(config, moduleInfo)))
         .pipe(gulpIf(hasLocalization, localizeXhtml(config, moduleInfo, pool)))
         .pipe(createRoutesInfoJson(changesStore, moduleInfo, pool))
         .pipe(createContentsJson(moduleInfo)) //зависит от buildStaticHtml и addComponentInfo
         .pipe(createStaticTemplatesJson(moduleInfo)) //зависит от buildStaticHtml и gulpBuildHtmlTmpl
         .pipe(
            gulpChmod({
               read: true,
               write: true
            })
         )
         .pipe(filterCached())
         .pipe(gulp.dest(moduleInfo.output));
   };
}

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

module.exports = generateTaskForBuildModules;
