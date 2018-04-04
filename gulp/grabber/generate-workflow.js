'use strict';

//модули из npm
const
   path = require('path'),
   gulp = require('gulp'),
   os = require('os'),
   fs = require('fs-extra'),
   workerPool = require('workerpool'),
   plumber = require('gulp-plumber');

const
   guardSingleProcess = require('../helpers/generate-task/guard-single-process.js'),
   generateTaskForGenerateJson = require('../helpers/generate-task/generate-json'),
   changedInPlace = require('../helpers/plugins/changed-in-place'),
   grabFile = require('./plugins/grab-file'),
   Configuration = require('./classes/configuration.js'),
   Cache = require('./classes/cache.js'),
   logger = require('../../lib/logger').logger();

function generateTaskForTerminatePool(pool) {
   return function terminatePool() {
      return pool.terminate();
   };
}

function generateTaskForSaveCache(cache) {
   return function saveCache() {
      return cache.save();
   };
}

function generateTaskForLoadCache(cache) {
   return function loadCache() {
      return cache.load();
   };
}

function generateTaskForGrabSingleModule(config, moduleInfo, cache, pool) {
   const moduleInput = path.join(moduleInfo.path, '/**/*.@(js|xhtml|tmpl)');

   return function grabModule() {
      return gulp.src(moduleInput, {'read': false, 'dot': false, 'nodir': true})
         .pipe(plumber({
            errorHandler: function(err) {
               logger.error({
                  message: 'Задача grabModule завершилась с ошибкой',
                  error: err,
                  moduleInfo: moduleInfo
               });
               this.emit('end');
            }
         }))
         .pipe(changedInPlace(cache))
         .pipe(grabFile(config, cache, moduleInfo, pool))
         .pipe(gulp.dest(moduleInfo.path));
   };
}

function generateTaskForGrabModules(changesStore, config, pool) {
   const tasks = [];
   let countCompletedModules = 0;

   const printPercentComplete = function(done) {
      countCompletedModules += 1;
      logger.progress(100 * countCompletedModules / config.modules.length);
      done();
   };

   for (const moduleInfo of config.modules) {
      tasks.push(
         gulp.series(
            generateTaskForGrabSingleModule(config, moduleInfo, changesStore, pool),
            printPercentComplete));
   }
   return gulp.parallel(tasks);
}

function generateTaskForSaveOutputJson(cache, config) {
   return async function saveOutputJson() {
      const result = Object.values(cache.getCachedFiles()).reduce((a, b) => {
         return a.concat(b);
      });
      await fs.writeJSON(config.outputPath, result, {spaces: 1});
   };
}

function generateWorkflow(processArgv) {
   //загрузка конфигурации должна быть синхронной, иначе не построятся задачи для сборки модулей
   const config = new Configuration();
   config.loadSync(processArgv); // eslint-disable-line no-sync

   const cache = new Cache(config);

   const pool = workerPool.pool(
      path.join(__dirname, './worker.js'),
      {
         maxWorkers: os.cpus().length
      });

   return gulp.series(
      guardSingleProcess.generateTaskForLock(config.cachePath), //прежде всего
      generateTaskForLoadCache(cache),
      generateTaskForGenerateJson(cache, config),
      generateTaskForGrabModules(cache, config, pool),
      gulp.parallel( //завершающие задачи
         generateTaskForSaveCache(cache),
         generateTaskForSaveOutputJson(cache, config),
         generateTaskForTerminatePool(pool)),
      guardSingleProcess.generateTaskForUnlock() //после всего
   );
}

module.exports = generateWorkflow;
