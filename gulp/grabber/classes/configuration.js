/* eslint-disable no-sync */

/**
 * @author Бегунов Ал. В.
 */

'use strict';

const ConfigurationReader = require('../../helpers/configuration-reader'),
   ModuleInfo = require('../../helpers/base-module-info');

/**
 * Класс с данными о конфигурации сборки
 */
class GrabberConfiguration {
   constructor() {
      // путь до файла конфигурации
      this.configFile = '';

      // не приукрашенные данные конфигурации. используются в changes-store для решения о сбросе кеша
      this.rawConfig = {};

      // список объектов, содержащий в себе полную информацию о модулях.
      this.modules = [];

      // путь до папки с кешем
      this.cachePath = '';
   }

   loadSync(argv) {
      this.configFile = ConfigurationReader.getConfigPath(argv);
      this.rawConfig = ConfigurationReader.readConfigFileSync(this.configFile);

      for (const module of this.rawConfig.modules) {
         this.modules.push(new ModuleInfo(module.name, module.responsible, module.path));
      }

      const startErrorMessage = `Файл конфигурации ${this.configFile} не корректен.`;

      this.outputPath = this.rawConfig.output;
      if (!this.outputPath) {
         throw new Error(`${startErrorMessage} Не задан обязательный параметр output`);
      }

      if (!this.outputPath.endsWith('.json')) {
         throw new Error(`${startErrorMessage} Параметр output должен быть json-файлом.`);
      }

      this.cachePath = this.rawConfig.cache;
      if (!this.cachePath) {
         throw new Error(`${startErrorMessage} Не задан обязательный параметр cache`);
      }
   }
}

module.exports = GrabberConfiguration;
