'use strict';

/**
 * список обязательных для работы Gulp модулей.
 * @type {Array}
 */
const necessaryModules = ['Core', 'WS.Core', 'Data', 'WS.Data', 'Controls', 'View'];

/**
 * Проверяет конфигурацию запуска Gulp на наличие обязательных для сборки
 * Интерфейсных модулей
 * @param {Array} configModules - набор Интерфейсных модулей из конфигурации.
 * @returns {Array} - набор отсутствующих в конфиге обязательных модулей.
 */
function checkForNecessaryModules(configModules) {
   const configModulesSet = new Set(configModules.map(module => module.name));
   return necessaryModules.filter(mandatorModuleName => !configModulesSet.has(mandatorModuleName));
}
module.exports = checkForNecessaryModules;
