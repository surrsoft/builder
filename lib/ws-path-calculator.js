'use strict';

function getWsRoot(splittedCore) {
   if (splittedCore) {
      return '/resources/WS.Core/';
   } else {
      return '/ws/';
   }
}
function getResources() {
   return '/resources/';
}

module.exports = {
   getWsRoot: getWsRoot,
   getResources: getResources
};
