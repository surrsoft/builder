/**
 * Генерирует поток выполнения сборки статики
 * @author Бегунов Ал. В.
 */

'use strict';

const fs = require('fs-extra'),
   gulp = require('gulp'),
   pMap = require('p-map');

const generateTaskForBuildModules = require('./generate-task/build-modules'),
   { generateTaskForCollectThemes } = require('./generate-task/collect-style-themes'),
   generateTaskForFinalizeDistrib = require('./generate-task/finalize-distrib'),
   generateTaskForCompress = require('./generate-task/compress'),
   generateTaskForPackHtml = require('./generate-task/pack-html'),
   generateTaskForCustomPack = require('./generate-task/custom-packer'),
   generateTaskForGenerateJson = require('../common/generate-task/generate-json'),
   generateTaskForSaveNewThemes = require('./generate-task/save-new-themes'),
   guardSingleProcess = require('../common/generate-task/guard-single-process.js'),
   generateTaskForPrepareWS = require('../common/generate-task/prepare-ws'),
   generateTaskForSaveJoinedMeta = require('../common/generate-task/save-joined-meta'),
   { checkModuleDependenciesExisting } = require('../../lib/check-module-dependencies'),
   { typescriptCompiler } = require('../../lib/typescript-compiler'),
   generateTaskForSaveLoggerReport = require('../common/generate-task/save-logger-report'),
   Cache = require('./classes/cache'),
   Configuration = require('./classes/configuration.js'),
   TaskParameters = require('../common/classes/task-parameters');

const {
   generateTaskForLoadCache,
   generateTaskForInitWorkerPool,
   generateTaskForTerminatePool
} = require('../common/helpers');

/**
 * Генерирует поток выполнения сборки статики
 * @param {string[]} processArgv массив аргументов запуска утилиты
 * @returns {Undertaker.TaskFunction} gulp задача
 */
function generateWorkflow(processArgv) {
   // загрузка конфигурации должна быть синхронной, иначе не построятся задачи для сборки модулей
   const config = new Configuration();
   config.loadSync(processArgv); // eslint-disable-line no-sync

   const taskParameters = new TaskParameters(
      config,
      new Cache(config),
      config.localizations.length > 0
   );

   return gulp.series(

      // generateTaskForLock прежде всего
      guardSingleProcess.generateTaskForLock(taskParameters),
      generateTaskForLoadCache(taskParameters),
      generateTaskForCollectThemes(taskParameters),

      // в generateTaskForClearCache нужен загруженный кеш
      generateTaskForClearCache(taskParameters),

      // подготовка WS для воркера
      generateTaskForPrepareWS(taskParameters),
      generateTaskForInitWorkerPool(taskParameters),
      generateTaskForGenerateJson(taskParameters),
      generateTaskForTypescriptCompile(taskParameters),
      generateTaskForBuildModules(taskParameters),

      generateTaskForRemoveFiles(taskParameters),
      generateTaskForSaveNewThemes(taskParameters),
      generateTaskForSaveCache(taskParameters),
      generateTaskForFinalizeDistrib(taskParameters.config),
      generateTaskForCheckModuleDeps(taskParameters),
      generateTaskForPackHtml(taskParameters),
      generateTaskForCustomPack(taskParameters),
      generateTaskForCompress(taskParameters),
      generateTaskForTerminatePool(taskParameters),
      generateTaskForSaveJoinedMeta(taskParameters),
      generateTaskForSaveLoggerReport(taskParameters),

      // generateTaskForUnlock после всего
      guardSingleProcess.generateTaskForUnlock()
   );
}

function generateTaskForClearCache(taskParameters) {
   return function clearCache() {
      return taskParameters.cache.clearCacheIfNeeded();
   };
}

function generateTaskForTypescriptCompile(taskParameters) {
   if (!taskParameters.config.tsc) {
      return function skipRunTypescriptCompiler(done) {
         done();
      };
   }
   return function runTypescriptCompiler() {
      return typescriptCompiler(taskParameters);
   };
}

function generateTaskForSaveCache(taskParameters) {
   return function saveCache() {
      return taskParameters.cache.save();
   };
}

function generateTaskForRemoveFiles(taskParameters) {
   return async function removeOutdatedFiles() {
      const filesForRemove = await taskParameters.cache.getListForRemoveFromOutputDir(
         taskParameters.config.cachePath,
         taskParameters.config.modulesForPatch
      );
      return pMap(filesForRemove, filePath => fs.remove(filePath), {
         concurrency: 20
      });
   };
}

function generateTaskForCheckModuleDeps(taskParameters) {
   if (!taskParameters.config.checkModuleDependencies) {
      return function skipCheckModuleDepsExisting(done) {
         done();
      };
   }
   return function checkModuleDepsExisting() {
      return checkModuleDependenciesExisting(taskParameters);
   };
}

module.exports = generateWorkflow;
