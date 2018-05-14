'use strict';

const path = require('path'),
   fs = require('fs-extra'),
   gulp = require('gulp'),
   os = require('os'),
   workerPool = require('workerpool'),
   pMap = require('p-map');

const generateTaskForBuildModules = require('./generate-task/build-modules'),
   generateTaskForFinalizeDistrib = require('./generate-task/finalize-distrib'),
   generateTaskForGenerateJson = require('../helpers/generate-task/generate-json'),
   guardSingleProcess = require('../helpers/generate-task/guard-single-process.js'),
   ChangesStore = require('./classes/changes-store'),
   Configuration = require('./classes/configuration.js');

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
      return pMap(filesForRemove, filePath => fs.remove(filePath), {
         concurrency: 20
      });
   };
}

function generateWorkflow(processArgv) {
   //загрузка конфигурации должна быть снхронной, иначе не построятся задачи для сборки модулей
   const config = new Configuration();
   config.loadSync(processArgv); // eslint-disable-line no-sync

   const changesStore = new ChangesStore(config);

   const pool = workerPool.pool(path.join(__dirname, './worker.js'), {
      maxWorkers: os.cpus().length
   });

   const localizationEnable = config.localizations.length > 0;

   return gulp.series(
      guardSingleProcess.generateTaskForLock(config.cachePath), //прежде всего
      generateTaskForLoadChangesStore(changesStore),
      generateTaskForClearCache(changesStore, config), //тут нужен загруженный кеш
      generateTaskForGenerateJson(changesStore, config, localizationEnable),
      generateTaskForBuildModules(changesStore, config, pool),
      gulp.parallel(

         //завершающие задачи
         generateTaskForRemoveFiles(changesStore),
         generateTaskForSaveChangesStore(changesStore),
         generateTaskForTerminatePool(pool)
      ),
      generateTaskForFinalizeDistrib(config, localizationEnable),
      guardSingleProcess.generateTaskForUnlock() //после всего
   );
}

module.exports = generateWorkflow;
