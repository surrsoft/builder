/* eslint-disable no-sync */

/**
 * @author Бегунов Ал. В.
 */

'use strict';

const path = require('path');
const ConfigurationReader = require('../../common/configuration-reader'),
   ModuleInfo = require('./module-info'),
   { getLanguageByLocale, clearSourcesSymlinks, checkForSourcesOutput } = require('../../../lib/config-helpers'),
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

      // папка с результатами сборки
      this.outputPath = '';

      // список поддерживаемых локалей
      this.localizations = [];

      // локаль по умолчанию
      this.defaultLocalization = '';

      // если проект не мультисервисный, то в статических html нужно заменить некоторые переменные
      this.multiService = false;

      // Current service relative url
      this.urlServicePath = '';

      // BL service relative url
      this.urlDefaultServicePath = '';

      // compiled content version
      this.version = '';

      // logs output directory
      this.logFolder = '';

      // run typescript compilation
      this.typescript = false;

      // run less compilation
      this.less = false;

      // build common meta information for Presentation Service
      this.presentationServiceMeta = false;

      // generate "contents" for application's work
      this.contents = false;

      // build static html pages based on Vdom/WS4
      this.htmlWml = false;

      // build dynamic templates to AMD-type javascript code.
      this.wml = false;

      // build static html pages based on component's Webpage options. Option is deprecated.
      this.deprecatedWebPageTemplates = false;

      // build old xml-type dynamic templates to AMD-type javascript code. Option is deprecated.
      this.deprecatedXhtml = false;

      // pack component's own dependencies. Option is deprecated.
      this.deprecatedOwnDependencies = false;

      // pack static html entry points to static packages.
      this.deprecatedStaticHtml = false;

      // minify sources and compiled modules
      this.minimize = false;

      // generate packages based on custom developer's configuration
      this.customPack = false;

      // generate project dependencies tree meta
      this.dependenciesGraph = false;

      // compress sources to gzip and brotli formats
      this.compress = false;

      // compile themed styles
      this.themes = false;

      // enable old themes in less compile
      this.oldThemes = true;

      // join module's meta files into common root meta file
      this.joinedMeta = false;

      // enable tsc compiler with "noEmit" flag(compile without saving - for errors check)
      this.tsc = false;

      // copy sources to output directory
      this.sources = true;

      // paste "resources" prefix to links
      this.resourcesUrl = true;

      // make symlinks for source files
      this.symlinks = true;

      // clear output directory
      this.clearOutput = true;

      // enable autoprefixer postprocessor in less compiler
      this.autoprefixer = true;
   }

   /**
    * Configuring all common flags for Builder plugins
    */
   configureBuildFlags() {
      // write all bool parameters of readed config. Builder will use only known flags.
      Object.keys(this.rawConfig).forEach((currentOption) => {
         if (this.rawConfig.hasOwnProperty(currentOption) && typeof this.rawConfig[currentOption] === 'boolean') {
            this[currentOption] = this.rawConfig[currentOption];
         }
      });

      // themes flag - input value can be boolean or array
      if (this.rawConfig.hasOwnProperty('themes')) {
         const { themes } = this.rawConfig;
         if (typeof themes === 'boolean' || themes instanceof Array === true) {
            this.themes = themes;
         }
      }

      // autoprefixer option - input value can be bollean or object
      if (this.rawConfig.hasOwnProperty('autoprefixer')) {
         const { autoprefixer } = this.rawConfig;
         switch (typeof autoprefixer) {
            case 'boolean':
               this.autoprefixer = autoprefixer;
               break;
            case 'object':
               if (!(autoprefixer instanceof Array)) {
                  this.autoprefixer = autoprefixer;
               }
               break;
            default:
               break;
         }
      }
   }

   /**
    * returns build mode in depend on
    * given Gulp configuration's flags
    * @returns {string}
    */
   getBuildMode() {
      const packingEnabled = this.deprecatedOwnDependencies || this.customPack || this.deprecatedStaticHtml;

      // if we are getting packing task as input, minimization should be enabled
      if (packingEnabled && !this.minimize) {
         this.minimize = true;
      }

      return this.minimize || packingEnabled ? 'release' : 'debug';
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

      this.configureBuildFlags();
      this.cachePath = this.rawConfig.cache;
      this.isReleaseMode = this.getBuildMode() === 'release';

      if (!this.isReleaseMode) {
         this.outputPath = this.rawConfig.output;
      } else {
         // некоторые задачи для сборки дистрибутивак не совместимы с инкрементальной сборкой,
         // потому собираем в папке кеша, а потом копируем в целевую директорию
         this.outputPath = path.join(this.cachePath, 'incremental_build');

         // always enable tsc compiler in release mode
         this.tsc = true;
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

      const isSourcesOutput = checkForSourcesOutput(this.rawConfig);
      if (isSourcesOutput) {
         this.isSourcesOutput = isSourcesOutput;
      }

      this.needTemplates = this.rawConfig.wml || this.rawConfig.htmlWml || this.rawConfig.deprecatedXhtml;

      this.branchTests = this.rawConfig.cld_name === 'InTest';

      if (this.rawConfig.hasOwnProperty('logs')) {
         this.logFolder = this.rawConfig.logs;
      }

      clearSourcesSymlinks(this.cachePath);

      // modules for patch - when we need to rebuild part of project modules instead of full rebuild.
      this.modulesForPatch = [];
      for (const module of this.rawConfig.modules) {
         const moduleInfo = new ModuleInfo(
            module.name,
            module.responsible,
            module.path,
            this.outputPath,
            module.required,
            module.rebuild,
            module.depends
         );

         if (moduleInfo.rebuild) {
            this.modulesForPatch.push(moduleInfo);
         }

         /**
          * "View" module needed for template's build.
          */
         if (moduleInfo.name === 'View') {
            this.templateBuilder = true;
         }
         moduleInfo.symlinkInputPathToAvoidProblems(this.cachePath, true);

         moduleInfo.contents.buildMode = this.getBuildMode();
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

      /**
       * Temporarily enable extendable bundles only for sbis plugin to avoid
       * patches building in online project.
       * TODO remove it after task completion
       * https://online.sbis.ru/opendoc.html?guid=7e4b2c14-4779-471a-935f-2fd12990d814
       * @type {*|boolean}
       */
      this.isSbisPlugin = this.rawConfig.cld_name && this.rawConfig.cld_name.startsWith('SbisPlugin');
      this.extendBundles = this.isSbisPlugin;
      if (this.rawConfig.hasOwnProperty('builderTests')) {
         this.builderTests = this.rawConfig.builderTests;
         this.extendBundles = true;
      }
   }
}

module.exports = BuildConfiguration;
