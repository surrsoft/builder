/**
 * Генерация задачи для подготовки WS к исполнению в builder'е.
 * Из-за того, что часть кода написана на ES5 (AMD модули), а другая часть на ES6 и TypeScript,
 * нужно привести к одному знаменателю.
 * @author Бегунов Ал. В.
 */

'use strict';

const path = require('path'),
   os = require('os'),
   gulp = require('gulp'),
   plumber = require('gulp-plumber'),
   gulpIf = require('gulp-if'),
   workerPool = require('workerpool'),
   pluginCompileEsAndTs = require('../../builder/plugins/simple-compile-es-and-ts'),
   logger = require('../../../lib/logger').logger();

const wsModulesNames = ['ws', 'WS.Core', 'Core', 'View', 'Controls'];

/**
 * Генерация задачи инкрементальной сборки модулей.
 * @param {TaskParameters} taskParameters параметры задачи
 * @returns {Undertaker.TaskFunction}
 */
function generateTaskForPrepareWS(taskParameters) {
   const modulesFromWS = taskParameters.config.modules.filter(moduleInfo => wsModulesNames.includes(moduleInfo.name));

   const pool = workerPool.pool(path.join(__dirname, '../worker-compile-es-and-ts.js'), {

      // Нельзя занимать больше ядер чем есть. Основной процесс тоже потребляет ресурсы
      maxWorkers: os.cpus().length - 1 || 1
   });

   const seriesTask = [];
   if (modulesFromWS.length) {
      seriesTask.push(
         gulp.parallel(
            modulesFromWS.map(moduleInfo => generateTaskForPrepareWSModule(taskParameters.config, moduleInfo, pool))
         )
      );
   }
   seriesTask.push(() => pool.terminate());
   return gulp.series(seriesTask);
}

function generateTaskForPrepareWSModule(config, moduleInfo, pool) {
   const moduleInput = path.join(moduleInfo.path, '/**/*.*');
   const moduleOutput = path.join(config.cachePath, 'platform', path.basename(moduleInfo.path));
   return function buildWSModule() {
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
         .pipe(pluginCompileEsAndTs(moduleInfo, pool))
         .pipe(gulpIf(needSymlink, gulp.symlink(moduleOutput), gulp.dest(moduleOutput)));
   };
}

function needSymlink(file) {
   // если файл порождён нами же, то симлинк не применим
   return file.history.length === 1;
}

module.exports = generateTaskForPrepareWS;
