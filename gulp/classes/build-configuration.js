'use strict';

const
   fs = require('fs'),
   ModuleInfo = require('./module-info');

class BuildConfiguration {
   constructor() {
      this.isReleaseMode = false;
      this.cachePath = '';
      this.outputPath = '';
      this.localizations = [];
      this.defaultLocalization = '';
      this.modules = [];
   }

   async load(argv) {
      //для получения 1 параметра --config не нужна сторонняя библиотека
      let configFile = '';
      argv.forEach(value => {
         if (value.startsWith('--config=')) {
            configFile = value.replace('--config=', '');
         }
      });

      const isFileExist = await fs.pathExists(configFile);
      if (!isFileExist) {
         return 'Файл конфигурации не задан или файл не существует.';
      }

      let rawConfig;
      try {
         rawConfig = await fs.readJSON(configFile);
      } catch (e) {
         return 'Файл конфигурации не корректен. Он должен представлять собой JSON-документ в кодировке UTF8. Ошибка: ' + e.message;
      }

      if (rawConfig.hasOwnProperty('mode')) {
         const mode = rawConfig.mode;
         if (mode !== 'release' && mode !== 'debug') {
            return 'Параметр mode может принимать значения "release" и "debug"';
         }
         this.isReleaseMode = mode === 'release';
      } else {
         return 'Не задан обязательный параметр mode';
      }

      this.outputPath = rawConfig.output;
      this.cachePath = rawConfig.cache;
      this.localizations = rawConfig.localizations;
      this.defaultLocalization = rawConfig['default-localization'];
      for (const module of rawConfig.modules) {
         this.modules.push(new ModuleInfo(
            module.name,
            module.responsible,
            module.path,
            this.outputPath
         ));
      }


      return '';
   }

}

module.exports = BuildConfiguration;
