/**
 * Вспомогательные функциия для сборки
 * @author Бегунов Ал. В.
 */
'use strict';

const path = require('path'),
   os = require('os'),
   logger = require('../../lib/logger').logger(),
   workerPool = require('workerpool');

/**
 * Функция, которая нужна в сборке для выбора между gulp.dest и gulp.symlink
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {Function} возвращаем функцию для gulp-if
 */
function needSymlink(config, moduleInfo) {
   const hasLocalization = config.localizations.length > 0;
   return (file) => {
      // в релизе нельзя применять симлинки
      if (config.isReleaseMode) {
         return false;
      }

      // при локализации изменяются файлы с вёрсткой, нельзя использовать симлинки
      if (hasLocalization && ['.html', '.tmpl', 'xhtml'].includes(file.extname)) {
         return false;
      }

      // нельзя использовать симлинки для файлов, которые мы сами генерируем.
      // абсолютный путь в relativePath  может получиться только на windows, если не получилось построить относительный
      const relativePath = path.relative(moduleInfo.path, file.history[0]);
      if (relativePath.includes('..') || path.isAbsolute(relativePath)) {
         return false;
      }

      // если была транслитерация путей(признак file.history.length > 1), то симлинки не работают.
      // ошибка в самом gulp.
      return file.history.length === 1;
   };
}

/**
 * Получать директорию модуля
 * @param {Object[]} modules список модулей из оригиноального конфига
 * @param {string} moduleName имя модуля, для которого получаем директорию
 * @returns {string}
 */
function getDirnameForModule(modules, moduleName) {
   for (const module of modules) {
      if (module.name === moduleName) {
         return module.path;
      }
   }
   return '';
}

/**
 * Генерация задачи загрузки кеша сборки
 * @param {TaskParameters} taskParameters параметры для задач
 * @returns {function(): *}
 */
function generateTaskForLoadCache(taskParameters) {
   return function loadCache() {
      return taskParameters.cache.load();
   };
}

/**
 * Генерация задачи инициализации пула воркеров
 * @param {TaskParameters} taskParameters параметры для задач
 * @returns {function(): *}
 */
function generateTaskForInitWorkerPool(taskParameters) {
   return function initWorkerPool(done) {
      // Нельзя занимать больше ядер чем есть. Основной процесс тоже потребляет ресурсы
      taskParameters.setWorkerPool(
         workerPool.pool(path.join(__dirname, '../common/worker.js'), {
            maxWorkers: os.cpus().length - 1 || 1,
            forkOpts: {
               env: {
                  'ws-core-path': getDirnameForModule(taskParameters.config.rawConfig.modules, 'WS.Core')
               }
            }
         })
      );

      done();
   };
}

/**
 * Генерация задачи убийства пула воркеров
 * @param {TaskParameters} taskParameters параметры для задач
 * @returns {function(): *}
 */
function generateTaskForTerminatePool(taskParameters) {
   return function terminatePool() {
      return taskParameters.pool.terminate();
   };
}

/**
 * Оборачивает функцию в воркере, чтобы была возможность вернуть ошибки и варнинги от WS.
 * Работает в тандеме с gulp/helpers/exec-in-pool.js
 * @param {Function} func функция, которую оборачиваем
 * @returns {Function}
 */
function wrapWorkerFunction(func) {
   return async(funcArgs, filePath = null, moduleInfo = null) => {
      logger.setInfo(filePath, moduleInfo);
      let result;
      try {
         result = func(...funcArgs);
         if (result instanceof Promise) {
            result = await result;
         }
      } catch (error) {
         return [{ message: error.message, stack: error.stack }, null, logger.getMessageForReport()];
      }
      return [null, result, logger.getMessageForReport()];
   };
}


module.exports = {
   needSymlink,
   generateTaskForLoadCache,
   generateTaskForInitWorkerPool,
   generateTaskForTerminatePool,
   wrapWorkerFunction,
   getDirnameForModule
};
