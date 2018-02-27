'use strict';

const
   path = require('path'),
   gulp = require('gulp'),
   gulpRename = require('gulp-rename'),
   gulpStripBom = require('gulp-stripbom'),
   gulpChmod = require('gulp-chmod'),
   plumber = require('gulp-plumber');

//наши плагины
const
   gulpHtmlTmpl = require('../plugins/html-tmpl'),
   changedInPlace = require('../plugins/changed-in-place'),
   addComponentInfo = require('../plugins/add-component-info'),
   buildStaticHtml = require('../plugins/build-static-html'),
   createRoutesInfoJson = require('../plugins/create-routes-info-json'),
   createContentsJson = require('../plugins/create-contents-json');


const
   logger = require('../../lib/logger').logger(),
   transliterate = require('../../lib/transliterate');

function generateTaskForBuildSingleModule(moduleInfo, modulesMap, changesStore, pool) {
   const moduleInput = path.join(moduleInfo.path, '/**/*.*');

   return function buildModule() {
      return gulp.src(moduleInput)
         .pipe(plumber({
            errorHandler: function(err) {
               logger.error({
                  message: 'Задача buildModule завершилась с ошибкой',
                  error: err,
                  moduleInfo: moduleInfo
               });
               this.emit('end');
            }
         }))
         .pipe(changedInPlace(changesStore, moduleInfo))
         .pipe(addComponentInfo(changesStore, moduleInfo, pool))
         .pipe(buildStaticHtml(changesStore, moduleInfo, modulesMap))
         .pipe(gulpHtmlTmpl(moduleInfo))
         .pipe(gulpRename(file => {
            file.dirname = transliterate(file.dirname);
            file.basename = transliterate(file.basename);
         }))
         .pipe(createRoutesInfoJson(changesStore, moduleInfo, pool))
         .pipe(createContentsJson(moduleInfo)) //зависит от buildStaticHtml и addComponentInfo
         .pipe(gulpStripBom({
            showLog: false
         }))
         .pipe(gulpChmod({
            read: true,
            write: true
         }))
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
            generateTaskForBuildSingleModule(moduleInfo, modulesMap, changesStore, pool),
            printPercentComplete));
   }
   return gulp.parallel(tasks);
}

module.exports = generateTaskForBuildModules;
