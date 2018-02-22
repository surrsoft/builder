/* eslint-disable no-sync */
'use strict';

const
   fs = require('fs-extra'),
   ModuleInfo = require('./module-info');

class BuildConfiguration {
   constructor() {
      this.isReleaseMode = false;
      this.cachePath = '';
      this.outputPath = '';
      this.localizations = [];
      this.defaultLocalization = '';
      this.modules = [];
      this.rawConfig = {};
   }

   loadSync(argv) {
      //для получения 1 параметра --config не нужна сторонняя библиотека
      let configFile = '';
      argv.forEach(value => {
         if (value.startsWith('--config=')) {
            configFile = value.replace('--config=', '');
         }
      });

      if (!configFile) {
         throw new Error('Файл конфигурации не задан.');
      }

      if (!fs.pathExistsSync(configFile)) {
         throw new Error(`Файл конфигурации '${configFile}' не существует.`);
      }

      const startErrorMessage = `Файл конфигурации ${configFile} не корректен.`;
      try {
         this.rawConfig = fs.readJSONSync(configFile);
      } catch (e) {
         e.message = `${startErrorMessage} Он должен представлять собой JSON-документ в кодировке UTF8. Ошибка: ${e.message}`;
         throw e;
      }

      if (!this.rawConfig.hasOwnProperty('mode')) {
         throw new Error(`${startErrorMessage} Не задан обязательный параметр mode`);
      }
      const mode = this.rawConfig.mode;
      if (mode !== 'release' && mode !== 'debug') {
         throw new Error(`${startErrorMessage} Параметр mode может принимать значения "release" и "debug"`);
      }
      this.isReleaseMode = mode === 'release';


      this.outputPath = this.rawConfig.output;
      if (!this.outputPath) {
         throw new Error(`${startErrorMessage} Не задан обязательный параметр output`);
      }

      this.cachePath = this.rawConfig.cache;
      if (!this.cachePath) {
         throw new Error(`${startErrorMessage} Не задан обязательный параметр cache`);
      }

      this.localizations = this.rawConfig.localizations;
      this.defaultLocalization = this.rawConfig['default-localization'];

      if (!this.rawConfig.hasOwnProperty('modules')) {
         throw new Error(`${startErrorMessage} Не задан обязательный параметр modules`);
      }
      if (!Array.isArray(this.rawConfig.modules)) {
         throw new Error(`${startErrorMessage} Параметр modules должен быть массивом`);
      }
      if (this.rawConfig.modules.length === 0) {
         throw new Error(`${startErrorMessage} Массив modules должен быть не пустым`);
      }
      for (const module of this.rawConfig.modules) {
         if (!module.hasOwnProperty('path') || !module.path) {
            throw new Error(`${startErrorMessage} Для модуля не задан обязательный параметр path`);
         }
         if (!fs.pathExistsSync(module.path)) {
            throw new Error(`${startErrorMessage} Директория ${module.path} не существует`);
         }
         this.modules.push(new ModuleInfo(
            module.name,
            module.responsible,
            module.path,
            this.outputPath
         ));
      }
   }

}

module.exports = BuildConfiguration;
