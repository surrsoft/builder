'use strict';

/**
 * список обязательных для работы Gulp модулей. В 510 убираем Data.
 * Оставляем в 600, тогда Data станет общеобязательным модулей.
 * @type {Array}
 */
const necessaryModules = ['Core', 'WS.Core', 'WS.Data'];

/**
 * Проверяет конфигурацию запуска Gulp на наличие обязательных для сборки
 * Интерфейсных модулей
 * @param {Array} configModules - набор Интерфейсных модулей из конфигурации.
 * @returns {Array} - набор отсутствующих в конфиге обязательных модулей.
 */
function checkForNecessaryModules(configModules) {
   const configModulesSet = new Set(configModules.map(module => module.name));
   return necessaryModules.filter(necessaryModuleName => !configModulesSet.has(necessaryModuleName));
}

/**
 * Проверяет конфигурацию запуска Gulp на наличие конкретного модуля
 * @param {String} neededModule - проверяемый модуль
 * @param {Array} configModules - набор Интерфейсных модулей из конфигурации.
 * @returns {boolean} - наличие модуля в конфигурации для Gulp
 */
function checkForNeededModule(neededModule, configModules) {
   const configModulesSet = new Set(configModules.map(module => module.name));
   return configModulesSet.has(neededModule);
}

/**
 * Проверяет переданный набор Интерфейсных модулей на наличие в конфигурации
 * Gulp
 * @param {Array} neededModules - набор проверяемых модулей.
 * @param {Array} configModules - набор Интерфейсных модулей из конфигурации.
 * @returns {Array} - набор недостающих модулей.
 */
function getMissedTemplateModules(neededModules, configModules) {
   const result = [];
   neededModules.forEach((module) => {
      if (!checkForNeededModule(module, configModules)) {
         result.push(module);
      }
   });
   return result;
}

module.exports = {
   checkForNecessaryModules,
   getMissedTemplateModules
};
