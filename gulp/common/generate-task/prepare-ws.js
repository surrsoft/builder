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
   pluginCompileEsAndTs = require('../../builder/plugins/compile-es-and-ts-simple'),
   TaskParameters = require('../../common/classes/task-parameters'),
   logger = require('../../../lib/logger').logger();

const {
   generateTaskForTerminatePool
} = require('../helpers');

const wsModulesNames = ['ws', 'WS.Core', 'Core', 'View', 'Controls', 'WS.Data'];

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

   const localTaskParameters = new TaskParameters(taskParameters.config, taskParameters.cache, false, pool);
   const seriesTask = [];
   if (modulesFromWS.length) {
      seriesTask.push(
         gulp.parallel(
            modulesFromWS.map(moduleInfo => generateTaskForPrepareWSModule(localTaskParameters, moduleInfo))
         )
      );
   }
   seriesTask.push(generateTaskForTerminatePool(localTaskParameters));
   return gulp.series(seriesTask);
}

function generateTaskForPrepareWSModule(localTaskParameters, moduleInfo) {
   return function buildWSModule() {
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
         .pipe(pluginCompileEsAndTs(localTaskParameters, moduleInfo))
         .pipe(gulpIf(needSymlink, gulp.symlink(moduleOutput), gulp.dest(moduleOutput)));
   };
}

function needSymlink(file) {
   // если файл порождён нами же, то симлинк не применим
   return file.history.length === 1;
}

module.exports = generateTaskForPrepareWS;
