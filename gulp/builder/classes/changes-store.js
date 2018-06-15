'use strict';

const path = require('path'),
   fs = require('fs-extra'),
   assert = require('assert'),
   pMap = require('p-map');

const helpers = require('../../../lib/helpers'),
   transliterate = require('../../../lib/transliterate'),
   packageJson = require('../../../package.json'),
   logger = require('../../../lib/logger').logger();

class ModuleCacheInfo {
   constructor() {
      this.componentsInfo = {};
      this.routesInfo = {};
      this.markupCache = {};
   }
}

class StoreInfo {
   constructor() {
      // в случае изменений параметров запуска проще кеш сбросить,
      // чем потом ошибки на стенде ловить. не сбрасываем только кеш json
      this.runningParameters = {};

      // если поменялась версия билдера, могло помянятся решительно всё. и кеш json в том числе
      // unknown используется далее
      this.versionOfBuilder = 'unknown';

      // время начала предыдущей сборки. нам не нужно хранить дату изменения каждого файла
      // для сравнения с mtime у файлов
      this.startBuildTime = 0;

      // запоминаем что было на входе и что породило на выход, чтобы потом можно было
      // 1. отследить восстановленный из корзины файл
      // 2. удалить лишние файлы
      this.inputPaths = {};

      // для инкрементальной сборки нужно знать зависимости файлов:
      // - imports из less файлов
      // - зависимости js на файлы вёрстки для паковки собственных зависмостей
      this.dependencies = {};

      // нужно сохранять информацию о компонентах и роутингах для заполнения contents.json
      this.modulesCache = {};

      // Чтобы ошибки не терялись при инкрементальной сборке, нужно запоминать файлы с ошибками
      // и подавать их при повторном запуске как изменённые
      this.filesWithErrors = new Set();
   }

   async load(filePath) {
      logger.debug(`Читаем файл кеша ${filePath}`);

      try {
         if (await fs.pathExists(filePath)) {
            const obj = await fs.readJSON(filePath);
            this.runningParameters = obj.runningParameters;
            this.versionOfBuilder = obj.versionOfBuilder;
            logger.debug(`В кеше versionOfBuilder: ${this.versionOfBuilder}`);
            this.startBuildTime = obj.startBuildTime;
            logger.debug(`В кеше startBuildTime: ${this.startBuildTime}`);
            this.inputPaths = obj.inputPaths;
            this.dependencies = obj.dependencies;
            this.modulesCache = obj.modulesCache;
            this.filesWithErrors = new Set(obj.filesWithErrors);
         }
      } catch (error) {
         logger.info({
            message: `Не удалось прочитать файл кеша ${filePath}`,
            error
         });
      }
   }

   save(filePath) {
      return fs.outputJson(
         filePath,
         {
            runningParameters: this.runningParameters,
            versionOfBuilder: this.versionOfBuilder,
            startBuildTime: this.startBuildTime,
            inputPaths: this.inputPaths,
            dependencies: this.dependencies,
            modulesCache: this.modulesCache,
            filesWithErrors: [...this.filesWithErrors]
         },
         {
            spaces: 1
         }
      );
   }
}

class ChangesStore {
   constructor(config) {
      this.config = config;
      this.lastStore = new StoreInfo();
      this.currentStore = new StoreInfo();
      this.dropCacheForMarkup = false;

      // js и less файлы инвалидируются с зависимостями
      // less - зависмости через import
      // js - зависимости на xhtml и tmpl для кастомной паковки
      this.cacheChanges = {};

      // сохраняем в кеше moduleDependencies для быстрого доступа в паковке, чтобы не читать файлы
      this.moduleDependencies = {
         links: {},
         nodes: {}
      };
   }

   load() {
      this.currentStore.runningParameters = this.config.rawConfig;
      this.currentStore.versionOfBuilder = packageJson.version;
      this.currentStore.startBuildTime = new Date().getTime();
      for (const moduleInfo of this.config.modules) {
         this.currentStore.modulesCache[moduleInfo.name] = new ModuleCacheInfo();
         this.currentStore.inputPaths[moduleInfo.path] = [];
      }

      this.filePath = path.join(this.config.cachePath, 'store.json');
      return this.lastStore.load(this.filePath);
   }

   save() {
      return this.currentStore.save(this.filePath);
   }

   async cacheHasIncompatibleChanges() {
      const finishText = 'Кеш и результат предыдущей сборки будут удалены, если существуют.';
      if (this.lastStore.versionOfBuilder === 'unknown') {
         logger.info(`Не удалось обнаружить валидный кеш от предыдущей сборки. ${finishText}`);
         return true;
      }
      const lastRunningParameters = Object.assign({}, this.lastStore.runningParameters);
      const currentRunningParameters = Object.assign({}, this.currentStore.runningParameters);

      // поле version всегда разное
      if (lastRunningParameters.version !== '' || currentRunningParameters.version !== '') {
         if (lastRunningParameters.version === '' || currentRunningParameters.version === '') {
            logger.info(`Параметры запуска builder'а поменялись. ${finishText}`);
            return true;
         }
         lastRunningParameters.version = '';
         currentRunningParameters.version = '';
      }
      try {
         assert.deepEqual(lastRunningParameters, currentRunningParameters);
      } catch (error) {
         logger.info(`Параметры запуска builder'а поменялись. ${finishText}`);
         return true;
      }

      // новая версия билдера может быть полностью не совместима
      const isNewBuilder = this.lastStore.versionOfBuilder !== this.currentStore.versionOfBuilder;
      if (isNewBuilder) {
         logger.info(`Версия builder'а не соответствует сохранённому значению в кеше. ${finishText}`);
         return true;
      }

      // если нет хотя бы одной папки не оказалось на месте, нужно сбросить кеш
      const promisesExists = [];
      for (const moduleInfo of this.config.modules) {
         promisesExists.push(fs.pathExists(moduleInfo.output));
      }
      const resultsExists = await Promise.all(promisesExists);
      if (resultsExists.includes(false)) {
         logger.info(`Как минимум один из результирующих каталогов был удалён. ${finishText}`);
         return true;
      }
      return false;
   }

   async clearCacheIfNeeded() {
      const removePromises = [];
      if (await this.cacheHasIncompatibleChanges()) {
         this.lastStore = new StoreInfo();

         // из кеша можно удалить всё кроме .lockfile
         if (await fs.pathExists(this.config.cachePath)) {
            for (const fullPath of await fs.readdir(this.config.cachePath)) {
               if (!fullPath.endsWith('.lockfile')) {
                  removePromises.push(fs.remove(fullPath));
               }
            }
         }
         if (await fs.pathExists(this.config.outputPath)) {
            removePromises.push(fs.remove(this.config.outputPath));
         }
      }

      // если собираем дистрибутив, то config.rawConfig.output нужно всегда очищать
      if (this.config.version) {
         if (await fs.pathExists(this.config.rawConfig.output)) {
            removePromises.push(fs.remove(this.config.rawConfig.output));
         }
      }
      logger.info('Запускается очистка кэша');
      await Promise.all(removePromises);
      logger.info('Очистка кэша завершена');
   }

   async isFileChanged(filePath, fileMTime, moduleInfo) {
      const prettyPath = helpers.prettifyPath(filePath);
      const relativePath = path.relative(moduleInfo.path, filePath);
      const outputFullPath = path.join(moduleInfo.output, transliterate(relativePath));
      this.currentStore.inputPaths[prettyPath] = [helpers.prettifyPath(outputFullPath)];

      // кеша не было, значит все файлы новые
      if (!this.lastStore.startBuildTime) {
         return true;
      }

      // если сборка с локализацией и свойства компонентов поменялись
      if (this.dropCacheForMarkup && (prettyPath.endsWith('.xhtml') || prettyPath.endsWith('.tmpl'))) {
         return true;
      }

      // новый файл
      if (!this.lastStore.inputPaths.hasOwnProperty(prettyPath)) {
         return true;
      }

      // файл с ошибкой
      if (this.lastStore.filesWithErrors.has(prettyPath)) {
         return true;
      }

      // проверка modification time
      if (fileMTime.getTime() > this.lastStore.startBuildTime) {
         if (prettyPath.endsWith('.less') || prettyPath.endsWith('.js')) {
            this.cacheChanges[prettyPath] = true;
         }
         return true;
      }

      // вытащим данные из старого кеша в новый кеш
      const lastModuleCache = this.lastStore.modulesCache[moduleInfo.name];
      const currentModuleCache = this.currentStore.modulesCache[moduleInfo.name];
      if (lastModuleCache.componentsInfo.hasOwnProperty(prettyPath)) {
         currentModuleCache.componentsInfo[prettyPath] = lastModuleCache.componentsInfo[prettyPath];
      }
      if (lastModuleCache.markupCache.hasOwnProperty(prettyPath)) {
         currentModuleCache.markupCache[prettyPath] = lastModuleCache.markupCache[prettyPath];
      }
      if (lastModuleCache.routesInfo.hasOwnProperty(prettyPath)) {
         currentModuleCache.routesInfo[prettyPath] = lastModuleCache.routesInfo[prettyPath];
      }
      if (this.lastStore.dependencies.hasOwnProperty(prettyPath)) {
         this.currentStore.dependencies[prettyPath] = this.lastStore.dependencies[prettyPath];
      }

      if (prettyPath.endsWith('.less') || prettyPath.endsWith('.js')) {
         const dependenciesChanged = await this.isDependenciesChanged(prettyPath);
         const isChanged = dependenciesChanged.length > 0 && dependenciesChanged.some(changed => changed);
         this.cacheChanges[prettyPath] = isChanged;
         return isChanged;
      }
      return false;
   }

   addOutputFile(filePath, outputFilePath, moduleInfo) {
      const prettyFilePath = helpers.prettifyPath(filePath);
      const outputPrettyPath = helpers.prettifyPath(outputFilePath);
      if (this.currentStore.inputPaths.hasOwnProperty(prettyFilePath)) {
         this.currentStore.inputPaths[prettyFilePath].push(outputPrettyPath);
      } else {
         this.currentStore.inputPaths[moduleInfo.path].push(outputPrettyPath);
      }
   }

   getInputPathsByFolder(modulePath) {
      return Object.keys(this.currentStore.inputPaths).filter(filePath => filePath.startsWith(modulePath));
   }

   markFileAsFailed(filePath) {
      const prettyPath = helpers.prettifyPath(filePath);
      this.currentStore.filesWithErrors.add(prettyPath);
   }

   addDependencies(filePath, imports) {
      const prettyPath = helpers.prettifyPath(filePath);
      this.currentStore.dependencies[prettyPath] = imports.map(helpers.prettifyPath);
   }

   isDependenciesChanged(filePath) {
      return pMap(
         this.getAllDependencies(filePath),
         async(currentPath) => {
            if (this.cacheChanges.hasOwnProperty(currentPath)) {
               return this.cacheChanges[currentPath];
            }
            let isChanged = false;
            if (await fs.pathExists(currentPath)) {
               const currentMTime = (await fs.lstat(filePath)).mtime.getTime();
               isChanged = currentMTime > this.lastStore.startBuildTime;
            } else {
               isChanged = true;
            }
            this.cacheChanges[currentPath] = isChanged;
            return isChanged;
         },
         {
            concurrency: 20
         }
      );
   }

   getAllDependencies(filePath) {
      const prettyPath = helpers.prettifyPath(filePath);
      const results = new Set();
      const queue = [prettyPath];

      while (queue.length > 0) {
         const currentPath = queue.pop();
         if (this.lastStore.dependencies.hasOwnProperty(currentPath)) {
            for (const dependency of this.lastStore.dependencies[currentPath]) {
               if (!results.has(dependency)) {
                  results.add(dependency);
                  queue.push(dependency);
               }
            }
         }
      }
      return Array.from(results);
   }

   storeComponentInfo(filePath, moduleName, componentInfo) {
      const prettyPath = helpers.prettifyPath(filePath);
      if (!componentInfo) {
         // если парсер упал на файле, то нужно выкинуть файл из inputPaths,
         // чтобы ошибка повторилась при повторном запуске
         if (this.currentStore.inputPaths.hasOwnProperty(prettyPath)) {
            delete this.currentStore.inputPaths[prettyPath];
         }
      } else {
         const currentModuleCache = this.currentStore.modulesCache[moduleName];
         currentModuleCache.componentsInfo[prettyPath] = componentInfo;
      }
   }

   getComponentsInfo(moduleName) {
      const currentModuleCache = this.currentStore.modulesCache[moduleName];
      return currentModuleCache.componentsInfo;
   }

   storeBuildedMarkup(filePath, moduleName, obj) {
      const prettyPath = helpers.prettifyPath(filePath);
      const currentModuleCache = this.currentStore.modulesCache[moduleName];
      currentModuleCache.markupCache[prettyPath] = obj;
   }

   getMarkupCache(moduleName) {
      const currentModuleCache = this.currentStore.modulesCache[moduleName];
      return currentModuleCache.markupCache;
   }

   storeRouteInfo(filePath, moduleName, routeInfo) {
      const prettyPath = helpers.prettifyPath(filePath);
      if (!routeInfo) {
         // если парсер упал на файле, то нужно выкинуть файл из inputPaths,
         // чтобы ошибка повторилась при повторном запуске
         if (this.currentStore.inputPaths.hasOwnProperty(prettyPath)) {
            delete this.currentStore.inputPaths[prettyPath];
         }
      } else {
         const currentModuleCache = this.currentStore.modulesCache[moduleName];
         currentModuleCache.routesInfo[prettyPath] = routeInfo;
      }
   }

   getRoutesInfo(moduleName) {
      const currentModuleCache = this.currentStore.modulesCache[moduleName];
      return currentModuleCache.routesInfo;
   }

   static getOutputFilesSet(inputPaths) {
      const resultSet = new Set();
      for (const filePath in inputPaths) {
         if (!inputPaths.hasOwnProperty(filePath)) {
            continue;
         }
         for (const outputFilePath of inputPaths[filePath]) {
            resultSet.add(outputFilePath);
         }
      }
      return resultSet;
   }

   async getListForRemoveFromOutputDir() {
      const currentOutputSet = ChangesStore.getOutputFilesSet(this.currentStore.inputPaths);
      const lastOutputSet = ChangesStore.getOutputFilesSet(this.lastStore.inputPaths);
      const removeFiles = Array.from(lastOutputSet).filter(filePath => !currentOutputSet.has(filePath));

      const results = await pMap(
         removeFiles,
         async(filePath) => {
            let needRemove = false;
            let stat = null;
            try {
               // fs.access и fs.pathExists не правильно работают с битым симлинками
               // поэтому сразу используем fs.lstat
               stat = await fs.lstat(filePath);
            } catch (e) {
               // ничего нелать не нужно
            }

            // если файл не менялся в текущей сборке, то его нужно удалить
            // файл может менятся в случае если это, например, пакет из нескольких файлов
            if (stat) {
               needRemove = stat.mtime.getTime() < this.currentStore.startBuildTime;
            }

            return {
               filePath,
               needRemove
            };
         },
         {
            concurrency: 20
         }
      );
      return results
         .map((obj) => {
            if (obj.needRemove) {
               return obj.filePath;
            }
            return null;
         })
         .filter(filePath => !!filePath);
   }

   setDropCacheForMarkup() {
      this.dropCacheForMarkup = true;
   }

   storeLocalModuleDependencies(obj) {
      this.moduleDependencies = {
         links: { ...this.moduleDependencies.links, ...obj.links },
         nodes: { ...this.moduleDependencies.nodes, ...obj.nodes }
      };
   }

   getModuleDependencies() {
      return this.moduleDependencies;
   }
}

module.exports = ChangesStore;
