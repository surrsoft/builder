/**
 * Вспомогательные функциия для сборки
 * @author Бегунов Ал. В.
 */
'use strict';

const path = require('path');

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
 * @returns {*}
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
 * @param {ChangesStore} changesStore кеш
 * @returns {function(): *}
 */
function generateTaskForLoadChangesStore(changesStore) {
   return function loadChangesStore() {
      return changesStore.load();
   };
}

/**
 * Генерация задачи убийства пула воркеров
 * @param {Pool} pool пул воркеров
 * @returns {function(): *}
 */
function generateTaskForTerminatePool(pool) {
   return function terminatePool() {
      return pool.terminate();
   };
}

module.exports = {
   needSymlink,
   getDirnameForModule,
   generateTaskForLoadChangesStore,
   generateTaskForTerminatePool
};
