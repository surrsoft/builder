'use strict';

/**
 * список обязательных для работы Gulp модулей.
 * @type {Set<string>}
 */
const mandatoryModules = new Set(['Core', 'WS.Core', 'Data', 'WS.Data', 'Controls', 'View']);

/**
 * Проверяет конфигурацию запуска Gulp на наличие обязательных для сборки
 * Интерфейсных модулей
 * @param {Array} configModules - набор Интерфейсных модулей из конфигурации.
 * @returns {Array} - набор отсутствующих в конфиге обязательных модулей.
 */
function checkForMandatoryModules(configModules) {
   const configModulesSet = new Set(configModules.map(module => module.name));
   const missedMandatorModules = [];
   mandatoryModules.forEach((mandatorModuleName) => {
      if (!configModulesSet.has(mandatorModuleName)) {
         missedMandatorModules.push(mandatorModuleName);
      }
   });
   return missedMandatorModules;
}
module.exports = checkForMandatoryModules;
