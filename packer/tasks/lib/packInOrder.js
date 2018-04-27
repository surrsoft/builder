'use strict';

const commonPackage = require('./../../lib/commonPackage');
const path = require('path');

/**
 * Функция собирает список бандлов, которые необходимо вставить в данную html-страницу в виде скриптов.
 * Все модули, которые лежат в данных пакетах, фильтруются и не попадают в rt-пакет.
 * @param orderQueue - изначальный список модулей, который мы хотим отфильтровать
 * @param bundlesOptions - опции для работы с бандлами: jsBundles - роутинг бандлов, в каком пакете каждый модуль лежит. bundlesScript - непосредственно сами пакеты,
 * которые впоследствии мы вставим в разметку
 * @returns {Array.<T>|*}
 */
function filterModulesAndGenerateBundles(orderQueue, bundlesOptions, application) {
   //добавляем лидирующий слэш если root и applicationRoot полностью совпали и replace вернул пустоту
   application = application ? application : '/';
   return orderQueue.js.filter(function(module) {
      const bundleForCurrentModule = bundlesOptions.jsBundles[module.fullName];
      if (bundleForCurrentModule) {
         bundlesOptions.bundlesScripts[`${path.join(application, bundleForCurrentModule).replace(/\\/g, '/')}.js`] = 1;
         if (bundlesOptions.logs) {
            bundlesOptions.logs[module.fullName] = bundleForCurrentModule;
         }
         return false;
      }
      return true;
   });
}

/**
 * @callback packInOrder~callback
 * @param {Error} error
 * @param {{js: string, css: string, dict: Object, cssForLocale: Object}} [result]
 */
/**
 * Формирует объект с пакетами js, css и объект dict с пакетом для каждой локали
 * @param {DepGraph} dg - граф зависимостей
 * @param {Array} modArray - массив вершин
 * @param {String} root - корень сервиса
 * @param {String} applicationRoot - корень сервиса
 * @param {Boolean} withoutDefine - паковать без define
 * @param {packInOrder~callback} done - callback
 * @param {String} themeName - имя темы
 * @param {String} staticHtmlName - имя статической html странички
 */
function packInOrder(dg, modArray, root, applicationRoot, withoutDefine, bundlesOptions, done, themeName, staticHtmlName) {
   let orderQueue;

   orderQueue = dg.getLoadOrder(modArray);
   orderQueue = commonPackage.prepareOrderQueue(dg, orderQueue, applicationRoot);
   orderQueue = commonPackage.prepareResultQueue(orderQueue, applicationRoot);
   if (bundlesOptions.jsBundles) {
      orderQueue.js = filterModulesAndGenerateBundles(orderQueue, bundlesOptions, applicationRoot.replace(root, ''));
   }

   if (withoutDefine) {
      commonPackage.getJsAndCssPackage(orderQueue, root, true, bundlesOptions, done);
   } else {
      commonPackage.getJsAndCssPackage(orderQueue, root, false, bundlesOptions, done, themeName, staticHtmlName);
   }
}

module.exports = packInOrder;
