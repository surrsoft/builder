/* eslint-disable no-sync */

/**
 * @author Бегунов Ал. В.
 */

'use strict';

const path = require('path');
const ConfigurationReader = require('../../common/configuration-reader'),
   ModuleInfo = require('./module-info'),
   getLanguageByLocale = require('../../../lib/get-language-by-locale'),
   checkForNecessaryModules = require('../../../lib/check-build-for-main-modules'),
   availableLanguage = require('../../../resources/availableLanguage.json');

/**
 * Класс с данными о конфигурации сборки
 */
class BuildConfiguration {
   constructor() {
      // путь до файла конфигурации
      this.configFile = '';

      // не приукрашенные данные конфигурации. используются в changes-store для решения о сбросе кеша
      this.rawConfig = {};

      // список объектов, содержащий в себе полную информацию о модулях.
      this.modules = [];

      // путь до папки с кешем
      this.cachePath = '';

      // release отличается от debug наличием паковки и минизации
      this.isReleaseMode = false;

      // папка с результатами сборки
      this.outputPath = '';

      // список поддерживаемых локалей
      this.localizations = [];

      // локаль по умолчанию
      this.defaultLocalization = '';

      // если проект не мультисервисный, то в статических html нужно заменить некоторые переменные
      this.multiService = false;

      // относительный url текущего сервиса
      this.urlServicePath = '';

      // относительный url сервиса БЛ
      this.urlDefaultServicePath = '';

      // относительный url текущего сервиса
      this.version = '';

      // папка, куда сохраняются все логи
      this.logFolder = '';
   }

   /**
    * Загрузка конфигурации из аргументов запуска утилиты.
    * Возможна только синхронная версия, т.к. это нужно делать перед генерацей workflow.
    * @param {string[]} argv массив аргументов запуска утилиты
    */
   loadSync(argv) {
      this.configFile = ConfigurationReader.getProcessParameters(argv).config;
      this.rawConfig = ConfigurationReader.readConfigFileSync(this.configFile);

      const startErrorMessage = `Файл конфигурации ${this.configFile} не корректен.`;

      // version есть только при сборке дистрибутива
      if (this.rawConfig.hasOwnProperty('version') && typeof this.rawConfig.version === 'string') {
         this.version = this.rawConfig.version;
      }

      this.cachePath = this.rawConfig.cache;
      if (!this.cachePath) {
         throw new Error(`${startErrorMessage} Не задан обязательный параметр cache`);
      }

      if (!this.rawConfig.output) {
         throw new Error(`${startErrorMessage} Не задан обязательный параметр output`);
      }

      if (!this.rawConfig.hasOwnProperty('mode')) {
         throw new Error(`${startErrorMessage} Не задан обязательный параметр mode`);
      }
      const { mode } = this.rawConfig;
      if (mode !== 'release' && mode !== 'debug') {
         throw new Error(`${startErrorMessage} Параметр mode может принимать значения "release" и "debug"`);
      }
      this.isReleaseMode = mode === 'release';

      if (!this.isReleaseMode) {
         this.outputPath = this.rawConfig.output;
      } else {
         // некоторые задачи для сборки дистрибутивак не совместимы с инкрементальной сборкой,
         // потому собираем в папке кеша, а потом копируем в целевую директорию
         this.outputPath = path.join(this.cachePath, 'incremental_build');
      }

      // localization может быть списком или false
      const hasLocalizations = this.rawConfig.hasOwnProperty('localization') && !!this.rawConfig.localization;

      // default-localization может быть строкой или false
      const hasDefaultLocalization =
         this.rawConfig.hasOwnProperty('default-localization') && !!this.rawConfig['default-localization'];

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
            throw new Error(
               `${startErrorMessage} Задан не корректный идентификатор локализаци по умолчанию: ${
                  this.defaultLocalization
               }`
            );
         }

         if (!this.localizations.includes(this.defaultLocalization)) {
            throw new Error(`${startErrorMessage} Локализация по умолчанию не указана в списке доступных локализаций`);
         }
      }

      const missedNecessaryModules = checkForNecessaryModules(this.rawConfig.modules);

      /**
       * Если нету общеобязательного набора Интерфейсных модулей, сборку завершаем с ошибкой.
       * Исключение: тесты билдера.
       */
      if (missedNecessaryModules.length > 0 && !this.rawConfig.builderTests) {
         throw new Error(`В вашем проекте отсутствуют следующие обязательные Интерфейсные модули для работы Gulp: 
         ${missedNecessaryModules}
         Добавьте их из $(SBISPlatformSDK)/ui-modules`);
      }

      for (const module of this.rawConfig.modules) {
         const moduleInfo = new ModuleInfo(module.name, module.responsible, module.path, this.outputPath);
         moduleInfo.symlinkInputPathToAvoidProblems(this.cachePath);

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

      if (this.rawConfig.hasOwnProperty('multi-service')) {
         this.multiService = this.rawConfig['multi-service'];
      }

      if (this.rawConfig.hasOwnProperty('url-service-path')) {
         this.urlServicePath = this.rawConfig['url-service-path'];
      }

      if (this.rawConfig.hasOwnProperty('url-default-service-path')) {
         this.urlDefaultServicePath = this.rawConfig['url-default-service-path'];
      } else {
         this.urlDefaultServicePath = this.urlServicePath;
      }

      if (this.rawConfig.hasOwnProperty('logs')) {
         this.logFolder = this.rawConfig.logs;
      }
   }
}

module.exports = BuildConfiguration;
