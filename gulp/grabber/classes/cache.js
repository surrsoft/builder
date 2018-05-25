'use strict';

const path = require('path'),
   fs = require('fs-extra'),
   assert = require('assert'),
   pMap = require('p-map');
const helpers = require('../../../lib/helpers'),
   packageJson = require('../../../package.json'),
   logger = require('../../../lib/logger').logger();

class StoreInfo {
   constructor() {
      // в случае изменений параметров запуска проще кеш сбросить, чем потом ошибки на стенде ловить. не сбрасываем только кеш json
      this.runningParameters = {};

      // если поменялась версия билдера, могло помянятся решительно всё. и кеш json в том числе
      this.versionOfBuilder = 'unknown'; // unknown используется далее

      // время начала предыдущей сборки. нам не нужно хранить дату изменения каждого файла
      // для сравнения с mtime у файлов
      this.startBuildTime = 0;

      // запоминаем соответствие "файл - список фраз для локализации"
      // 1. отследить восстановленный из корзины файл
      // 2. удалить лишние файлы
      this.cachedFiles = {};
   }

   async load(filePath) {
      try {
         if (await fs.pathExists(filePath)) {
            const obj = await fs.readJSON(filePath);
            this.runningParameters = obj.runningParameters;
            this.versionOfBuilder = obj.versionOfBuilder;
            this.startBuildTime = obj.startBuildTime;
            this.cachedFiles = obj.cachedFiles;
         }
      } catch (error) {
         logger.warning({
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
            cachedFiles: this.cachedFiles
         },
         {
            spaces: 1
         }
      );
   }
}

class Cache {
   constructor(config) {
      this.config = config;
      this.lastStore = new StoreInfo();
      this.currentStore = new StoreInfo();
      this.currentStore.runningParameters = this.config.rawConfig;
      this.currentStore.versionOfBuilder = packageJson.version;
      this.currentStore.startBuildTime = new Date().getTime();

      this.filePath = path.join(this.config.cachePath, 'grabber-cache.json');

      // если хоть 1 json описания компонента поменялся, то нужно обрабатывать xhtml и tmpl заново
      this.dropCacheForMarkup = false;
   }

   load() {
      return this.lastStore.load(this.filePath);
   }

   save() {
      return this.currentStore.save(this.filePath);
   }

   cacheHasIncompatibleChanges() {
      const finishText = 'Кеш будет очищен.';
      if (this.lastStore.versionOfBuilder === 'unknown') {
         logger.info('Не удалось обнаружить валидный кеш.');
         return true;
      }
      try {
         assert.deepEqual(this.lastStore.runningParameters, this.currentStore.runningParameters);
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

      return false;
   }

   async clearCacheIfNeeded() {
      const filesForRemove = [];
      if (this.cacheHasIncompatibleChanges()) {
         this.lastStore = new StoreInfo();

         // из кеша можно удалить всё кроме .lockfile
         if (await fs.pathExists(this.config.cachePath)) {
            for (const fullPath of await fs.readdir(this.config.cachePath)) {
               if (!fullPath.endsWith('.lockfile')) {
                  filesForRemove.push(fullPath);
               }
            }
         }
      }

      return pMap(filesForRemove, filePath => fs.remove(filePath), {
         concurrency: 20
      });
   }

   isFileChanged(filePath, fileMTime) {
      const prettyPath = helpers.prettifyPath(filePath);

      if (this.dropCacheForMarkup && (prettyPath.endsWith('.xhtml') || prettyPath.endsWith('.tmpl'))) {
         return true;
      }

      // кеша не было, значит все файлы новые
      const noCache = !this.lastStore.startBuildTime;

      // проверка modification time. этой проверки может быть не достаточно в двух слуаях:
      // 1. файл вернули из корзины
      // 2. файл не корректно был обработан в предыдущей сборке и мы не смогли определить зависимости
      const isModifiedFile = fileMTime.getTime() > this.lastStore.startBuildTime;

      const isChanged = noCache || isModifiedFile || !this.lastStore.cachedFiles.hasOwnProperty(prettyPath); // новый файл

      if (!isChanged) {
         this.currentStore.cachedFiles[prettyPath] = this.lastStore.cachedFiles[prettyPath];
      }

      return isChanged;
   }

   setDropCacheForMarkup() {
      this.dropCacheForMarkup = true;
   }

   storeCollectWords(filePath, collectWords) {
      const prettyPath = helpers.prettifyPath(filePath);
      this.currentStore.cachedFiles[prettyPath] = collectWords;
   }

   getCachedFiles() {
      return this.currentStore.cachedFiles;
   }
}

module.exports = Cache;
