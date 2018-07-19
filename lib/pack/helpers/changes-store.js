'use strict';

/**
 * Возвращает кэш из changesStore для конкретной анализируемой зависимости
 * @param privateModulesCache - кэш из changesStore для приватных модулей
 * @param moduleName - имя анализируемой зависимости
 * @returns {String}
 */
function getCacheByModuleName(privateModulesCache, moduleName) {
   let result = null;
   Object.keys(privateModulesCache).forEach((cacheName) => {
      const currentCache = privateModulesCache[cacheName];
      if (currentCache.moduleName === moduleName) {
         result = currentCache.text;
      }
   });
   return result;
}

/**
 * Возвращает путь до исходного ES файла для анализируемой зависимости.
 * @param privateModulesCache - кэш из changesStore для приватных модулей
 * @param moduleName - имя анализируемой зависимости
 * @returns {String}
 */
function getSourcePathByModuleName(privateModulesCache, moduleName) {
   let result = null;
   Object.keys(privateModulesCache).forEach((cacheName) => {
      if (privateModulesCache[cacheName].moduleName === moduleName) {
         result = cacheName;
      }
   });
   return result;
}

module.exports = {
   getCacheByModuleName,
   getSourcePathByModuleName
};
