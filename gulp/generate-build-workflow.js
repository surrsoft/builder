'use strict';

//модули из npm
const
   path = require('path'),
   fs = require('fs-extra'),
   gulp = require('gulp'),
   os = require('os'),
   workerPool = require('workerpool');

const
   generateTaskForCompileLess = require('./generate-task/compile-less'),
   generateTaskForBuildModules = require('./generate-task/build-modules'),
   guardSingleProcess = require('./helpers/guard-single-process.js'),
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

function generateTaskForClearCache(changesStore) {
   return function clearCache() {
      return changesStore.clearCacheIfNeeded();
   };
}

function generateTaskForSaveChangesStore(changesStore) {
   return function saveChangesStore() {
      return changesStore.save();
   };
}

function generateTaskForRemoveFiles(changesStore) {
   return async function removeOutdatedFiles() {
      const filesForRemove = await changesStore.getListForRemoveFromOutputDir();
      return Promise.all(filesForRemove.map(filePath => fs.remove(filePath)));
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
      generateTaskForLockGuard(config), //прежде всего
      generateTaskForLoadChangesStore(changesStore),
      generateTaskForClearCache(changesStore, config), //тут нужен загруженный кеш
      generateTaskForBuildModules(changesStore, config, pool),
      generateTaskForCompileLess(changesStore, config, pool), //после сборки модулей
      gulp.parallel( //завершающие задачи
         generateTaskForRemoveFiles(changesStore),
         generateTaskForSaveChangesStore(changesStore),
         generateTaskForTerminatePool(pool)),
      generateTaskForUnlockGuard() //после всего
   );
}

module.exports = generateWorkflow;
