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
      generateTaskForFinalizeDistrib(taskParameters),
      generateTaskForCheckModuleDeps(taskParameters),
      generateTaskForPackHtml(taskParameters),
      generateTaskForCustomPack(taskParameters),
      generateTaskForCompress(taskParameters),
      generateTaskForTerminatePool(taskParameters),
      generateTaskForSaveJoinedMeta(taskParameters),
      generateTaskForSaveLoggerReport(taskParameters),
      generateTaskForSaveTimeReport(taskParameters),

      // generateTaskForUnlock после всего
      guardSingleProcess.generateTaskForUnlock()
   );
}

function generateTaskForSaveTimeReport(taskParameters) {
   return async function saveTimeReport() {
      const resultJson = [];
      let totalSummary = 0;
      const { tasksTimer } = taskParameters;

      // descending sort of tasks by build time
      const sortedTaskKeys = Object.keys(tasksTimer).sort((a, b) => {
         if (tasksTimer[a].summary > tasksTimer[b].summary) {
            return -1;
         }
         if (tasksTimer[a].summary < tasksTimer[b].summary) {
            return 1;
         }
         return 0;
      });
      const timeFormatter = (duration) => {
         const milliseconds = new Intl.NumberFormat().format((duration % 1000) / 100);
         let
            seconds = Math.floor((duration / 1000) % 60),
            minutes = Math.floor((duration / (1000 * 60)) % 60);

         minutes = (minutes < 10) ? `0${minutes}` : minutes;
         seconds = (seconds < 10) ? `0${seconds}` : seconds;

         return [
            parseInt(minutes, 10) ? `${minutes} m. ` : '',
            parseInt(seconds, 10) ? `${seconds} s. ` : '',
            `${milliseconds} ms.`
         ].join('');
      };
      for (const currentTask of sortedTaskKeys) {
         if (tasksTimer[currentTask].plugins) {
            const currentPlugins = tasksTimer[currentTask].plugins;

            // descending sort of plugins for current task by build time
            const sortedPlugins = Object.keys(currentPlugins).sort((a, b) => {
               if (currentPlugins[a].summary > currentPlugins[b].summary) {
                  return -1;
               }
               if (currentPlugins[a].summary < currentPlugins[b].summary) {
                  return 1;
               }
               return 0;
            });
            resultJson.push({
               Task: currentTask,
               plugin: '-',
               Time: timeFormatter(tasksTimer[currentTask].summary)
            });
            for (const currentPlugin of sortedPlugins) {
               resultJson.push({
                  Task: currentTask,
                  plugin:
                  currentPlugin,
                  Time: timeFormatter(tasksTimer[currentTask].plugins[currentPlugin].summary)
               });
            }
            totalSummary += tasksTimer[currentTask].summary;
         } else {
            resultJson.push({
               Task: currentTask,
               plugin: '-',
               Time: timeFormatter(tasksTimer[currentTask].summary)
            });
            totalSummary += tasksTimer[currentTask].summary;
         }
      }

      // firstly print total summary.
      resultJson.unshift({
         Task: '-',
         plugin: '-',
         Time: timeFormatter(totalSummary)
      });

      // eslint-disable-next-line no-console
      console.table(resultJson);
      await fs.outputJson(`${taskParameters.config.cachePath}/time-report.json`, resultJson);
   };
}
function generateTaskForClearCache(taskParameters) {
   return async function clearCache() {
      const startTime = Date.now();
      await taskParameters.cache.clearCacheIfNeeded();
      taskParameters.storeTaskTime('clearCache', startTime);
   };
}

function generateTaskForTypescriptCompile(taskParameters) {
   if (!taskParameters.config.tsc) {
      return function skipRunTypescriptCompiler(done) {
         done();
      };
   }
   return async function runTypescriptCompiler() {
      const startTime = Date.now();
      await typescriptCompiler(taskParameters);
      taskParameters.storeTaskTime('tsc compiler', startTime);
   };
}

function generateTaskForSaveCache(taskParameters) {
   return async function saveCache() {
      const startTime = Date.now();
      await taskParameters.cache.save();
      taskParameters.storeTaskTime('save cache', startTime);
   };
}

function generateTaskForRemoveFiles(taskParameters) {
   return async function removeOutdatedFiles() {
      const startTime = Date.now();
      const filesForRemove = await taskParameters.cache.getListForRemoveFromOutputDir(
         taskParameters.config.cachePath,
         taskParameters.config.modulesForPatch
      );
      await pMap(filesForRemove, filePath => fs.remove(filePath), {
         concurrency: 20
      });
      taskParameters.storeTaskTime('remove outdated files from output', startTime);
   };
}

function generateTaskForCheckModuleDeps(taskParameters) {
   if (!taskParameters.config.checkModuleDependencies) {
      return function skipCheckModuleDepsExisting(done) {
         done();
      };
   }
   return async function checkModuleDepsExisting() {
      const startTime = Date.now();
      await checkModuleDependenciesExisting(taskParameters);
      taskParameters.storeTaskTime('module dependencies checker', startTime);
   };
}

module.exports = generateWorkflow;
