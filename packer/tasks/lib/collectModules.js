'use strict';

const commonPackage = require('./../../lib/commonPackage');

/**
 * @callback collectModules~callback
 * @param {Error} error
 * @param {{js: Array, css: Array}} [result]
 */

/**
 * Формируем два массива с путями до js и css
 * @param {DepGraph} dg
 * @param {Array} modArray - массив вершин
 * @param {collectModules~callback} done - callback
 */
function collectModules(dg, modArray, bundlesOptions, done, themeName) {
   let
      orderQueue = dg.getLoadOrder(modArray),
      applicationRoot = JSON.parse(process.env.configParams).root;

   if (themeName) {
      orderQueue = orderQueue.filter(function removeControlsIfTheme(module) {
         return !~module.module.indexOf('SBIS3.CONTROLS');
      });
   }
   orderQueue = commonPackage.prepareOrderQueue(dg, orderQueue, '');
   orderQueue = orderQueue.filter((module) => {
      if (module.plugin === 'is') {
         if (module.moduleYes && (module.moduleYes.plugin === 'js' && module.moduleYes.amd || module.moduleYes.plugin === 'css')) {
            return true;
         }
      } else if (module.plugin === 'browser' || module.plugin === 'optional') {
         if (module.moduleIn && (module.moduleIn.plugin === 'js' && module.moduleIn.amd || module.moduleIn.plugin === 'css')) {
            return true;
         }
      } else {
         return !!(module.plugin === 'js' && module.amd || module.plugin === 'css');
      }
   });
   orderQueue = commonPackage.prepareResultQueue(orderQueue, applicationRoot);
   if (bundlesOptions.jsBundles) {
      orderQueue.js = orderQueue.js.filter(module => !bundlesOptions.jsBundles[module.fullName]);
   }

   const result = {
      css: orderQueue.css.map(mod => mod.fullPath).filter(path => !!path),
      js: orderQueue.js.map(mod => mod.fullPath).filter(path => !!path),
      modules: orderQueue.css.map(mod => mod.fullName).filter(fullName => !!fullName)
   };

   done(null, result);
}

module.exports = collectModules;
