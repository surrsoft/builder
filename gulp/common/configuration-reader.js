/* eslint-disable no-sync */

/**
 * Общие для сборок методы работы с файлом конфигурации
 * @author Бегунов Ал. В.
 */

'use strict';

const fs = require('fs-extra');
const path = require('path');

/**
 * Получить параметры командной строки, что начинаются с --
 * @param {string[]} argv спискок аргументов запуска утилиты
 * @returns {Object}
 */
function getProcessParameters(argv) {
   const result = {};
   for (const argument of argv) {
      const match = argument.match(/^--([^-=]+)=['"]?([^'"]*)['"]?$/i);
      if (match) {
         // eslint-disable-next-line prefer-destructuring
         result[match[1]] = match[2];
      }
   }
   return result;
}

/**
 * Synchronously reads gulp configuration file.
 * @param {string} configPath path for gulp config
 * @param {string} currentWorkDir path to current process working directory
 * @returns {Object} JSON-formatted object of current gulp configuration
 */
function readConfigFileSync(configPath, currentWorkDir) {
   if (!configPath) {
      throw new Error('You need to set up the path to gulp configuration file.');
   }

   const resolvedConfigPath = path.resolve(currentWorkDir, configPath);
   if (!fs.pathExistsSync(resolvedConfigPath)) {
      throw new Error(`Config file '${configPath}' doesn't exists.`);
   }

   let rawConfig = {};
   const startErrorMessage = `Config file ${configPath} is invalid.`;
   try {
      rawConfig = fs.readJSONSync(resolvedConfigPath);
   } catch (e) {
      e.message = `${startErrorMessage} It must be presented in UTF8-based JSON-formatted document. Error: ${
         e.message
      }`;
      throw e;
   }
   const root = path.dirname(configPath);
   checkModules(rawConfig, root);
   checkCacheAndLogsPath(rawConfig, root, startErrorMessage);
   return rawConfig;
}

function checkModules(rawConfig, root) {
   if (!rawConfig.hasOwnProperty('modules')) {
      throw new Error('Parameter "modules" must be specified.');
   }
   if (!Array.isArray(rawConfig.modules)) {
      throw new Error('Parameter "modules" must be specified as array only.');
   }
   if (rawConfig.modules.length === 0) {
      throw new Error('Parameter "modules" cannot be specified as empty array.');
   }
   for (const module of rawConfig.modules) {
      if (!module.hasOwnProperty('path') || !module.path) {
         throw new Error(`For current module "${module.name}" path must be specified.`);
      }

      // если в конфигурации заданы относительные пути, разрешаем их в абсолютные
      if (module.path.startsWith('./') || module.path.startsWith('../')) {
         module.path = path.resolve(root, module.path).replace(/\\/g, '/');
      }
      if (!fs.pathExistsSync(module.path)) {
         throw new Error(`Path ${module.path} doesn't exists.`);
      }
   }
}

function checkCacheAndLogsPath(rawConfig, root, startErrorMessage) {
   if (!rawConfig.cache) {
      throw new Error(`${startErrorMessage} Cache parameter must be specified.`);
   }

   if (!rawConfig.output) {
      throw new Error(`${startErrorMessage} Output parameter must be specified.`);
   }

   /**
    * если в конфигурации заданы относительные пути для кэша, логов и конечной директории,
    * разрешаем их в абсолютные
    */
   if (rawConfig.cache.startsWith('./') || rawConfig.cache.startsWith('../')) {
      rawConfig.cache = path.resolve(root, rawConfig.cache).replace(/\\/g, '/');
   }
   if (rawConfig.output.startsWith('./') || rawConfig.output.startsWith('../')) {
      rawConfig.output = path.resolve(root, rawConfig.output).replace(/\\/g, '/');
   }
   if (
      rawConfig.hasOwnProperty('logs') &&
      (rawConfig.logs.startsWith('./') || rawConfig.logs.startsWith('../'))
   ) {
      rawConfig.logs = path.resolve(root, rawConfig.logs).replace(/\\/g, '/');
   }
}

module.exports = {
   getProcessParameters,
   readConfigFileSync
};
