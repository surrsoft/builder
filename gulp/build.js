'use strict';

//модули из npm
const
   path = require('path'),
   gulp = require('gulp'),
   gulpRename = require('gulp-rename'),
   clean = require('gulp-clean');

//наши плагины
const
   gulpHtmlTmpl = require('./plugins/html-tmpl'),
   changedInPlace = require('./plugins/changed-in-place'),
   addComponentInfo = require('./plugins/add-component-info'),
   buildStaticHtml = require('./plugins/build-static-html'),
   createRoutesInfoJson = require('./plugins/create-routes-info-json'),
   createContentsJson = require('./plugins/create-contents-json'),
   buildLess = require('./plugins/build-less');

//разлчные хелперы
const
   transliterate = require('../lib/transliterate'),
   logger = require('../lib/logger').logger(),
   ChangesStore = require('./classes/changes-store');

const copyTaskGenerator = function(moduleInfo, modulesMap, changesStore) {
   const moduleInput = path.join(moduleInfo.path, '/**/*.*');

   return function copy() {
      return gulp.src(moduleInput)
         .pipe(changedInPlace(changesStore, moduleInfo.path))
         .pipe(addComponentInfo(moduleInfo))
         .pipe(buildStaticHtml(moduleInfo, modulesMap))
         .pipe(gulpRename(file => {
            file.dirname = transliterate(file.dirname);
            file.basename = transliterate(file.basename);
         }))
         .pipe(createRoutesInfoJson(moduleInfo))
         .pipe(createContentsJson(moduleInfo)) //зависит от buildStaticHtml и addComponentInfo
         .pipe(gulp.dest(moduleInfo.output));
   };
};

const htmlTmplTaskGenerator = function(moduleInfo) {
   const moduleInput = path.join(moduleInfo.path, '/**/*.html.tmpl');

   return function htmlTmpl() {
      return gulp.src(moduleInput)

      //.pipe(changedInPlace(changesStore, module.path))
         .pipe(gulpHtmlTmpl(moduleInfo))
         .pipe(gulpRename(file => {
            file.dirname = transliterate(file.dirname);
            file.basename = transliterate(file.basename);
            file.extname = ''; // *.html.tmpl => *.html
         }))
         .pipe(gulp.dest(moduleInfo.output));
   };
};

function buildLessTask(config) {
   return function lessTask() {
      return gulp.src(path.join(config.outputPath, '/**/*.less'))
         .pipe(buildLess(config.outputPath))
         .pipe(gulp.dest(config.outputPath));
   };
}


module.exports = {
   'create': function buildTask(config) {
      const buildTasks = [],
         changesStore = new ChangesStore(config.cachePath);

      let countCompletedModules = 0;

      const printPercentComplete = function(done) {
         countCompletedModules += 1;
         logger.progress(100 * countCompletedModules / config.modules.length);
         done();
      };

      const modulesMap = new Map();
      for (let moduleInfo of config.modules) {
         modulesMap.set(path.basename(moduleInfo.path), moduleInfo.path);
      }

      for (let moduleInfo of config.modules) {
         buildTasks.push(
            gulp.series(
               gulp.parallel(
                  copyTaskGenerator(moduleInfo, modulesMap, changesStore),
                  htmlTmplTaskGenerator(moduleInfo, changesStore)),
               printPercentComplete));
      }
      const clearTask = function remove(done) {
         let pattern = [];

         for (let modulePath in changesStore.store) {
            if (changesStore.store.hasOwnProperty(modulePath)) {
               if (!changesStore.store[modulePath].exist) {
                  pattern.push(transliterate(path.join(path.basename(modulePath)), '/**/*.*'));
               } else {
                  let files = changesStore.store[modulePath]['files'];
                  for (let filePath in files) {
                     if (files.hasOwnProperty(filePath)) {
                        let fileInfo = files[filePath];
                        if (!fileInfo.hasOwnProperty('exist')) {
                           const moduleName = path.basename(modulePath);
                           pattern.push(transliterate(path.join(moduleName, filePath)));
                        }
                     }
                  }
               }
            }
         }
         if (pattern.length) {
            return gulp.src(pattern, {read: false, cwd: config.outputPath, allowEmpty: true})
               .pipe(clean());
         } else {
            done();
         }
      };
      const saveChangedStoreTask = function saveChangedStore(done) {
         changesStore.save();
         done();
      };

      return gulp.series(
         gulp.parallel(buildTasks),
         buildLessTask(config),
         gulp.parallel(clearTask, saveChangedStoreTask));
   }
};
