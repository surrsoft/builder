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

   load(argv) {
      //для получения 1 параметра --config не нужна сторонняя библиотека
      let configFile = '';
      argv.forEach(value => {
         if (value.startsWith('--config=')) {
            configFile = value.replace('--config=', '');
         }
      });

      if (!fs.pathExistsSync(configFile)) {
         return 'Файл конфигурации не задан или файл не существует.';
      }

      try {
         this.rawConfig = fs.readJSONSync(configFile);
      } catch (e) {
         return 'Файл конфигурации не корректен. Он должен представлять собой JSON-документ в кодировке UTF8. Ошибка: ' + e.message;
      }

      if (this.rawConfig.hasOwnProperty('mode')) {
         const mode = this.rawConfig.mode;
         if (mode !== 'release' && mode !== 'debug') {
            return 'Параметр mode может принимать значения "release" и "debug"';
         }
         this.isReleaseMode = mode === 'release';
      } else {
         return 'Не задан обязательный параметр mode';
      }

      this.outputPath = this.rawConfig.output;
      this.cachePath = this.rawConfig.cache;
      this.localizations = this.rawConfig.localizations;
      this.defaultLocalization = this.rawConfig['default-localization'];
      for (const module of this.rawConfig.modules) {
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
