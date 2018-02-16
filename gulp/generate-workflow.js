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

//готовые задачи
const
   buildLessTask = require('./tasks/build-less');

//разлчные хелперы
const
   transliterate = require('../lib/transliterate'),
   logger = require('../lib/logger').logger(),
   ChangesStore = require('./classes/changes-store');

const generateTaskForBuildSingleModule = function(moduleInfo, modulesMap, changesStore, pool) {
   const moduleInput = path.join(moduleInfo.path, '/**/*.*');

   return function buildModule() {
      return gulp.src(moduleInput)
         .pipe(changedInPlace(changesStore, moduleInfo.path))
         .pipe(addComponentInfo(moduleInfo, pool))
         .pipe(buildStaticHtml(moduleInfo, modulesMap))
         .pipe(gulpHtmlTmpl(moduleInfo))
         .pipe(gulpRename(file => {
            file.dirname = transliterate(file.dirname);
            file.basename = transliterate(file.basename);
         }))
         .pipe(createRoutesInfoJson(moduleInfo, pool))
         .pipe(createContentsJson(moduleInfo)) //зависит от buildStaticHtml и addComponentInfo
         .pipe(gulp.dest(moduleInfo.output));
   };
};

function generateTaskForTerminatePool(pool) {
   return function terminatePool() {
      return pool.terminate();
   };
}

function generateTaskForLoadChangesStore(changesStore) {
   return function loadChangesStore() {
      return changesStore.load();
   };
}

function generateTaskForSaveChangesStore(changesStore) {
   return function saveChangesStore() {
      return changesStore.load();
   };
}

function generateTaskForRemoveFiles(changesStore, config) {
   return function removeOutdatedFiles(done) {
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

}

function generateTasksForBuildModules(changesStore, config, pool) {
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
   return tasks;
}

function generateWorkflow(config) {
   const pool = workerPool.pool(
      path.join(__dirname, './workers/build-worker.js'),
      {
         maxWorkers: os.cpus().length
      });

   const changesStore = new ChangesStore(config);

   return gulp.series(
      generateTaskForLoadChangesStore(changesStore),
      gulp.parallel(generateTasksForBuildModules(changesStore, config, pool)),
      buildLessTask(changesStore, config, pool),
      gulp.parallel(
         generateTaskForRemoveFiles(changesStore, config),
         generateTaskForSaveChangesStore(changesStore),
         generateTaskForTerminatePool(pool))
   );
}

module.exports = generateWorkflow;
