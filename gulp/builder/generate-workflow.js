'use strict';

const path = require('path'),
   fs = require('fs-extra'),
   gulp = require('gulp'),
   os = require('os'),
   workerPool = require('workerpool'),
   pMap = require('p-map');

const generateTaskForBuildModules = require('./generate-task/build-modules'),
   generateTaskForFinalizeDistrib = require('./generate-task/finalize-distrib'),
   generateTaskForPackHtml = require('./generate-task/pack-html'),
   generateTaskForCustomPack = require('./generate-task/custom-packer'),
   generateTaskForGenerateJson = require('../helpers/generate-task/generate-json'),
   guardSingleProcess = require('../helpers/generate-task/guard-single-process.js'),
   generateTaskForSaveLoggerReport = require('../helpers/generate-task/save-logger-report'),
   ChangesStore = require('./classes/changes-store'),
   Configuration = require('./classes/configuration.js'),
   logger = require('../../lib/logger').logger();

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
   // загрузка конфигурации должна быть синхронной, иначе не построятся задачи для сборки модулей
   const config = new Configuration();
   config.loadSync(processArgv); // eslint-disable-line no-sync

   const changesStore = new ChangesStore(config);

   const pool = workerPool.pool(path.join(__dirname, '../helpers/worker.js'), {

      // Нельзя занимать больше ядер чем есть. Основной процесс тоже потребляет ресурсы
      maxWorkers: os.cpus().length - 1 || 1
   });

   const localizationEnable = config.localizations.length > 0;

   return gulp.series(

      // generateTaskForLock прежде всего
      guardSingleProcess.generateTaskForLock(config.cachePath),
      generateTaskForLoadChangesStore(changesStore),

      // в generateTaskForClearCache нужен загруженный кеш
      generateTaskForClearCache(changesStore, config),
      generateTaskForGenerateJson(changesStore, config, localizationEnable),
      generateTaskForBuildModules(changesStore, config, pool),
      gulp.parallel(

         // завершающие задачи
         generateTaskForRemoveFiles(changesStore),
         generateTaskForSaveChangesStore(changesStore)
      ),
      generateTaskForFinalizeDistrib(config, pool, localizationEnable),
      generateTaskForPackHtml(changesStore, config, pool),
      generateTaskForCustomPack(changesStore, config),
      generateTaskForTerminatePool(pool),
      generateTaskForSaveLoggerReport(config),

      // generateTaskForUnlock после всего
      guardSingleProcess.generateTaskForUnlock()
   );
}

module.exports = generateWorkflow;
