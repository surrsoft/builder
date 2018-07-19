'use strict';

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
