'use strict';

function getWsRoot(splittedCore) {
   if (splittedCore) {
      return '/ws/';
   } else {
      return '/resources/WS.Core/';
   }
}
function getResources() {
   return '/resources/';
}

module.exports = {
   getWsRoot: getWsRoot,
   getResources: getResources
};
