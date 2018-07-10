'use strict';

/**
 * набор начал путей интерфейсных модулей, которые необходимо
 * заменить в соответствии с их использованием в require
 * Взято из актуального конфига для requirejs: ws/ext/requirejs/config.js
 */
const interfaceNamesMap = new Map([
   ['WS.Core/lib', 'Lib'],
   ['WS.Core/lib/Ext', 'Ext'],
   ['WS.Core/core', 'Core'],
   ['WS.Deprecated', 'Deprecated'],
   ['WS.Core/core/helpers', 'Helpers'],
   ['WS.Core/transport', 'Transport'],
   ['WS.Core/css', 'WS/css']
]);

function getRequireName(filePath) {
   const pathParts = filePath.split('/');
   let filePathPart, requireName;

   pathParts.pop();
   while (pathParts.length !== 0 && !requireName) {
      filePathPart = pathParts.join('/');
      requireName = interfaceNamesMap.get(filePathPart);
      pathParts.pop();
   }
   return requireName ? filePathPart : null;
}

function getPrettyPath(filePath) {
   const
      requireNameToReplace = getRequireName(filePath);

   let resultPath = filePath;
   if (requireNameToReplace) {
      resultPath = resultPath.replace(requireNameToReplace, interfaceNamesMap.get(requireNameToReplace));
   }
   return resultPath;
}

module.exports = {
   getPrettyPath
};
