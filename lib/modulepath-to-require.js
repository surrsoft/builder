'use strict';

/**
 * набор начал путей интерфейсных модулей, которые необходимо
 * заменить в соответствии с их использованием в require
 * Взято из актуального конфига для requirejs: ws/ext/requirejs/config.js
 */
const { requireJsSubstitutions } = require('./builder-constants');

const normalizeNamesMap = new Map([
   ['Lib', 'WS.Core/lib'],
   ['Ext', 'WS.Core/lib/Ext'],
   ['Core', 'WS.Core/core'],
   ['Transport', 'WS.Core/transport'],
   ['WS/css', 'WS.Core/css'],
   ['Deprecated', 'WS.Deprecated']
]);

function getRequireName(filePath) {
   const pathParts = filePath.split('/');
   let filePathPart, requireName;

   pathParts.pop();
   while (pathParts.length !== 0 && !requireName) {
      filePathPart = pathParts.join('/');
      requireName = requireJsSubstitutions.get(filePathPart);
      pathParts.pop();
   }
   return requireName ? filePathPart : null;
}

function getPrettyPath(filePath) {
   // в тестах ws всё ещё записан по старому
   let resultPath = filePath.replace(/^ws\//, 'WS.Core/');

   const requireNameToReplace = getRequireName(resultPath);
   if (requireNameToReplace) {
      resultPath = resultPath.replace(requireNameToReplace, requireJsSubstitutions.get(requireNameToReplace));
   }
   return resultPath;
}

function normalizeModuleName(filePath) {
   const firstModulePart = filePath.split('/').shift();

   let resultPath = filePath;
   if (normalizeNamesMap.has(firstModulePart)) {
      resultPath = resultPath.replace(firstModulePart, normalizeNamesMap.get(firstModulePart));
   }
   return resultPath;
}

module.exports = {
   getPrettyPath,
   normalizeModuleName
};
