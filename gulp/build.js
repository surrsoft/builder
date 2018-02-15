'use strict';

//модули из npm
const
   path = require('path'),
   gulp = require('gulp'),
   gulpRename = require('gulp-rename'),
   clean = require('gulp-clean'),
   os = require('os'),
   workerPool = require('workerpool');


//наши плагины
const
   gulpHtmlTmpl = require('./plugins/html-tmpl'),
   changedInPlace = require('./plugins/changed-in-place'),
   addComponentInfo = require('./plugins/add-component-info'),
   buildStaticHtml = require('./plugins/build-static-html'),
   createRoutesInfoJson = require('./plugins/create-routes-info-json'),
   createContentsJson = require('./plugins/create-contents-json');

const
   buildLessTask = require('./tasks/build-less');

//разлчные хелперы
const
   transliterate = require('../lib/transliterate'),
   logger = require('../lib/logger').logger(),
   ChangesStore = require('./classes/changes-store');

const copyTaskGenerator = function(moduleInfo, modulesMap, changesStore, compileLessTasks, pool) {
   const moduleInput = path.join(moduleInfo.path, '/**/*.*');

   return function copy() {
      return gulp.src(moduleInput)
         .pipe(changedInPlace(changesStore, moduleInfo.path))
         .pipe(addComponentInfo(moduleInfo, pool))
         .pipe(buildStaticHtml(moduleInfo, modulesMap))
         .pipe(gulpRename(file => {
            file.dirname = transliterate(file.dirname);
            file.basename = transliterate(file.basename);

            //TODO: нужно собарать список less в отдельном плагине
            if (file.extname === '.less') {
               const lessPath = path.join(moduleInfo.output, file.dirname, file.basename + file.extname);
               compileLessTasks[lessPath] = moduleInfo;
            }
         }))
         .pipe(createRoutesInfoJson(moduleInfo, pool))
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


module.exports = {
   'create': async function buildTask(config) {
      const pool = workerPool.pool(
         path.join(__dirname, './workers/build-worker.js'),
         {
            maxWorkers: os.cpus().length
         });

      const buildTasks = [],
         compileLessTasks = {};

      const changesStore = new ChangesStore(config.cachePath);
      await changesStore.load();

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
         buildTasks.push(
            gulp.series(
               gulp.parallel(
                  copyTaskGenerator(moduleInfo, modulesMap, changesStore, compileLessTasks, pool),
                  htmlTmplTaskGenerator(moduleInfo, changesStore)
               ),
               printPercentComplete));
      }
      const clearTask = function remove(done) {
         const pattern = [];

         for (const modulePath in changesStore.store) {
            if (changesStore.store.hasOwnProperty(modulePath)) {
               if (!changesStore.store[modulePath].exist) {
                  pattern.push(transliterate(path.join(path.basename(modulePath)), '/**/*.*'));
               } else {
                  const files = changesStore.store[modulePath].files;
                  for (const filePath in files) {
                     if (files.hasOwnProperty(filePath)) {
                        const fileInfo = files[filePath];
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
         }
         return done();
      };
      const saveChangedStoreTask = async function saveChangedStore(done) {
         await changesStore.save();
         done();
      };

      return gulp.series(
         gulp.parallel(buildTasks),
         buildLessTask(compileLessTasks, config.outputPath, pool),
         gulp.parallel(clearTask, saveChangedStoreTask),
         () => {
            return pool.terminate();
         }
      );
   }
};
