/**
 * Генерация задачи для подготовки WS к исполнению в builder'е.
 * Из-за того, что часть кода написана на ES5 (AMD модули), а другая часть на ES6 и TypeScript,
 * нужно привести к одному знаменателю.
 * @author Kolbeshin F.A.
 */

'use strict';

const path = require('path'),
   gulp = require('gulp'),
   plumber = require('gulp-plumber'),
   gulpChmod = require('gulp-chmod'),
   pluginCompileEsAndTs = require('../../builder/plugins/compile-es-and-ts-simple'),
   gulpIf = require('gulp-if'),
   changedInPlace = require('../../common/plugins/changed-in-place'),
   TaskParameters = require('../../common/classes/task-parameters'),
   startTask = require('../start-task-with-timer'),
   logger = require('../../../lib/logger').logger(),
   fs = require('fs-extra'),
   ModuleCache = require('../../builder/classes/modules-cache');

function generateDownloadModuleCache(taskParameters, moduleInfo) {
   const patchBuild = taskParameters.config.modulesForPatch && taskParameters.config.modulesForPatch.length > 0;
   return async function downloadModuleCache() {
      const lastCache = await getLastModuleCache(moduleInfo.cachePath);
      moduleInfo.cache = new ModuleCache(lastCache);
      if (patchBuild && lastCache) {
         /**
          * in patch for module with rebuild configuration we need to get new themes meta from the
          * last cache value
          * In patch build new themes interface modules may not be participating in patch build,
          * so we can lose meta for this modules.
          */
         if (moduleInfo.rebuild) {
            const currentStoreModulesCache = taskParameters.cache.currentStore;
            const lastStoreModulesCache = taskParameters.cache.lastStore;
            currentStoreModulesCache.newThemesModules = lastStoreModulesCache.newThemesModules;
         } else {
            // in patch for modules without rebuild configuration store cache "as is"
            moduleInfo.cache.currentStore = moduleInfo.cache.lastStore;
         }
      }
   };
}

async function getLastModuleCache(moduleCachePath) {
   if (await fs.pathExists(moduleCachePath)) {
      const result = await fs.readJson(moduleCachePath);
      return result;
   }
   return null;
}

function generateSaveModuleCache(moduleInfo) {
   return async function saveModuleCache() {
      await fs.outputJson(moduleInfo.cachePath, moduleInfo.cache.currentStore);
   };
}

/**
 * Генерация задачи инкрементальной сборки модулей.
 * @param {TaskParameters} taskParameters параметры задачи
 * @returns {Undertaker.TaskFunction}
 */
function generateTaskForPrepareWS(taskParameters) {
   if (!taskParameters.config.initCore) {
      return function skipPrepareWS(done) {
         done();
      };
   }

   const localTaskParameters = new TaskParameters(taskParameters.config, taskParameters.cache, false);
   localTaskParameters.tasksTimer = taskParameters.tasksTimer;
   const requiredModules = taskParameters.config.modules.filter(moduleInfo => moduleInfo.required);
   const buildWSModule = startTask('buildWSModule', localTaskParameters);
   if (requiredModules.length) {
      const tasks = [];
      for (const moduleInfo of requiredModules) {
         moduleInfo.cachePath = path.join(taskParameters.config.cachePath, 'modules-cache', `${moduleInfo.name}.json`);
         tasks.push(
            gulp.series(
               generateTaskForPrepareWSModule(localTaskParameters, moduleInfo)
            )
         );
      }
      return gulp.series(
         buildWSModule.start,
         gulp.parallel(tasks),
         buildWSModule.finish
      );
   }
   return function skipPrepareWS(done) {
      done();
   };
}

function generateTaskForPrepareWSModule(localTaskParameters, moduleInfo) {
   function buildWSModule() {
      const moduleInput = path.join(moduleInfo.path, '/**/*.*');
      const moduleOutput = path.join(localTaskParameters.config.cachePath, 'platform', path.basename(moduleInfo.path));
      logger.debug(`Задача buildWSModule. moduleInput: "${moduleInput}", moduleOutput: "${moduleOutput}"`);
      return gulp
         .src(moduleInput, { dot: false, nodir: true })
         .pipe(
            plumber({
               errorHandler(err) {
                  logger.error({
                     message: 'Задача buildWSModule завершилась с ошибкой',
                     error: err,
                     moduleInfo
                  });
                  this.emit('end');
               }
            })
         )

         // builder unit tests dont have cache
         .pipe(gulpIf(!!localTaskParameters.cache, changedInPlace(localTaskParameters, moduleInfo)))
         .pipe(pluginCompileEsAndTs(localTaskParameters, moduleInfo))
         .pipe(gulpChmod({ read: true, write: true }))
         .pipe(gulp.dest(moduleOutput));
   }

   return gulp.series(
      generateDownloadModuleCache(localTaskParameters, moduleInfo),
      buildWSModule,
      generateSaveModuleCache(moduleInfo)
   );
}

module.exports = generateTaskForPrepareWS;
