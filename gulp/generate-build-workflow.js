'use strict';

//модули из npm
const
   path = require('path'),
   fs = require('fs-extra'),
   gulp = require('gulp'),
   clean = require('gulp-clean'),
   os = require('os'),
   workerPool = require('workerpool');

const
   generateTaskForCompileLess = require('./generate-task/compile-less'),
   generateTaskForBuildModules = require('./generate-task/build-modules'),
   guardSingleProcess = require('./helpers/guard-single-process.js'),
   transliterate = require('../lib/transliterate'),
   ChangesStore = require('./classes/changes-store'),
   BuildConfiguration = require('./classes/build-configuration.js');

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

function generateTaskForClearCache(changesStore, config) {
   return function clearCache() {
      const removePromises = [];
      if (changesStore.cacheHasIncompatibleChanges()) {
         if (fs.pathExists(config.cachePath)) {
            removePromises.push(fs.remove(config.cachePath));
         }
         if (fs.pathExists(config.outputPath)) {
            removePromises.push(fs.remove(config.outputPath));
         }
      }
      return Promise.all(removePromises);
   };
}

function generateTaskForSaveChangesStore(changesStore) {
   return function saveChangesStore() {
      return changesStore.save();
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

function generateTaskForLockGuard(config) {
   return function lockGuard() {
      return guardSingleProcess.lock(config);
   };
}

function generateTaskForUnlockGuard() {
   return function unlockGuard() {
      return guardSingleProcess.unlock();
   };
}

function generateWorkflow(processArgv) {
   //загрузка конфигурации должна быть снхронной, иначе не построятся задачи для сборки модулей
   const config = new BuildConfiguration();
   config.loadSync(processArgv); // eslint-disable-line no-sync

   const changesStore = new ChangesStore(config);

   const pool = workerPool.pool(
      path.join(__dirname, './workers/build-worker.js'),
      {
         maxWorkers: os.cpus().length
      });

   return gulp.series(
      generateTaskForLoadChangesStore(changesStore),
      generateTaskForClearCache(changesStore, config),
      generateTaskForLockGuard(config), //после очистки кеша
      generateTaskForBuildModules(changesStore, config, pool),
      generateTaskForCompileLess(changesStore, config, pool),
      gulp.parallel(
         generateTaskForRemoveFiles(changesStore, config),
         generateTaskForSaveChangesStore(changesStore),
         generateTaskForTerminatePool(pool)),
      generateTaskForUnlockGuard()
   );
}

module.exports = generateWorkflow;
