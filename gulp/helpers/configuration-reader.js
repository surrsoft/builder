/* eslint-disable no-sync */
'use strict';

const
   fs = require('fs-extra');

function getConfigPath(argv) {
   //для получения 1 параметра --config не нужна сторонняя библиотека
   for (const argument of argv) {
      if (argument.startsWith('--config=')) {
         return argument.replace('--config=', '').replace(/"/g, '');
      }
   }
   return '';
}

function readConfigFile(configPath) {
   if (!configPath) {
      throw new Error('Файл конфигурации не задан.');
   }

   if (!fs.pathExistsSync(configPath)) {
      throw new Error(`Файл конфигурации '${configPath}' не существует.`);
   }

   let rawConfig = {};
   try {
      rawConfig = fs.readJSONSync(configPath);
   } catch (e) {
      e.message = `Файл конфигурации ${configPath} не корректен. Он должен представлять собой JSON-документ в кодировке UTF8. Ошибка: ${e.message}`;
      throw e;
   }
   checkModules(rawConfig);
   return rawConfig;
}

function checkModules(rawConfig) {
   if (!rawConfig.hasOwnProperty('modules')) {
      throw new Error('Не задан обязательный параметр modules');
   }
   if (!Array.isArray(rawConfig.modules)) {
      throw new Error('Параметр modules должен быть массивом');
   }
   if (rawConfig.modules.length === 0) {
      throw new Error('Массив modules должен быть не пустым');
   }
   for (const module of rawConfig.modules) {
      if (!module.hasOwnProperty('path') || !module.path) {
         throw new Error('Для модуля не задан обязательный параметр path');
      }
      if (!fs.pathExistsSync(module.path)) {
         throw new Error(`Директория ${module.path} не существует`);
      }
   }

}

module.exports = {
   getConfigPath: getConfigPath,
   readConfigFileSync: readConfigFile
};
