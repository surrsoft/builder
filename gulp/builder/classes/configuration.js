/* eslint-disable no-sync */
'use strict';

const
   ConfigurationReader = require('../../helpers/configuration-reader'),
   ModuleInfo = require('./module-info'),
   getLanguageByLocale = require('../../../lib/get-language-by-locale'),
   availableLanguage = require('sbis3-ws/ws/res/json/availableLanguage.json');

class BuildConfiguration {
   constructor() {
      //путь до файла конфигурации
      this.configFile = '';

      //не приукрашенные данные конфигурации. используются в changes-store для решения о сбросе кеша
      this.rawConfig = {};

      //список объектов, содержащий в себе полную информацию о модулях.
      this.modules = [];

      //путь до папки с кешем
      this.cachePath = '';

      //release отличается от debug наличием паковки и минизации
      this.isReleaseMode = false;

      //папка с результатами сборки
      this.outputPath = '';

      //список поддерживаемых локалей
      this.localizations = [];

      //локаль по умолчанию
      this.defaultLocalization = '';
   }

   loadSync(argv) {
      this.configFile = ConfigurationReader.getConfigPath(argv);
      this.rawConfig = ConfigurationReader.readConfigFileSync(this.configFile);

      const startErrorMessage = `Файл конфигурации ${this.configFile} не корректен.`;

      this.outputPath = this.rawConfig.output;
      if (!this.outputPath) {
         throw new Error(`${startErrorMessage} Не задан обязательный параметр output`);
      }

      if (!this.rawConfig.hasOwnProperty('mode')) {
         throw new Error(`${startErrorMessage} Не задан обязательный параметр mode`);
      }
      const mode = this.rawConfig.mode;
      if (mode !== 'release' && mode !== 'debug') {
         throw new Error(`${startErrorMessage} Параметр mode может принимать значения "release" и "debug"`);
      }
      this.isReleaseMode = mode === 'release';

      this.cachePath = this.rawConfig.cache;
      if (!this.cachePath) {
         throw new Error(`${startErrorMessage} Не задан обязательный параметр cache`);
      }

      const hasLocalizations = this.rawConfig.hasOwnProperty('localization');
      const hasDefaultLocalization = this.rawConfig.hasOwnProperty('default-localization');

      if (hasDefaultLocalization !== hasLocalizations) {
         throw new Error(`${startErrorMessage} Список локализаций и дефолтная локализация не согласованы`);
      }

      if (hasLocalizations) {
         this.localizations = this.rawConfig.localization;
         for (const currentLocal of this.localizations) {
            if (!availableLanguage.hasOwnProperty(currentLocal)) {
               throw new Error(`${startErrorMessage} Задан не корректный идентификатор локализаци: ${currentLocal}`);
            }
         }

         this.defaultLocalization = this.rawConfig['default-localization'];
         if (!availableLanguage.hasOwnProperty(this.defaultLocalization)) {
            throw new Error(`${startErrorMessage} Задан не корректный идентификатор локализаци по умолчанию: ${this.defaultLocalization}`);
         }

         if (!this.localizations.includes(this.defaultLocalization)) {
            throw new Error(`${startErrorMessage} Локализация по умолчанию не указана в списке доступных локализаций`);
         }
      }


      for (const module of this.rawConfig.modules) {
         const moduleInfo = new ModuleInfo(
            module.name,
            module.responsible,
            module.path,
            this.outputPath,
         );
         moduleInfo.contents.buildMode = mode;
         if (this.defaultLocalization && this.localizations.length > 0) {
            moduleInfo.contents.defaultLanguage = this.defaultLocalization;
            moduleInfo.contents.availableLanguage = {};
            for (const local of this.localizations) {
               moduleInfo.contents.availableLanguage[local] = getLanguageByLocale(local);
            }
         }
         this.modules.push(moduleInfo);
      }
   }
}

module.exports = BuildConfiguration;
