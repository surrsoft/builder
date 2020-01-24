/**
 * @author Kolbeshin F.A.
 */
'use strict';

const fs = require('fs-extra'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   pMap = require('p-map');

/**
 * Reads all files in selected meta folder and joins it into
 * one root cache meta
 * @param{String} cachePath - path to current build cache path
 * @param{String} currentMetaName - name of folder to be used for reading module-by-module meta files from it
 * @returns {Promise<void>}
 */
async function readAllFilesByCurrentCacheMeta(cachePath, currentMetaName) {
   const result = {};
   const currentCacheFilesList = await fs.readdir(path.join(cachePath, currentMetaName));
   await pMap(
      currentCacheFilesList,
      async(currentModuleCache) => {
         const currentModuleName = path.basename(currentModuleCache, '.json');
         result[currentModuleName] = await fs.readJson(path.join(cachePath, currentMetaName, currentModuleCache));
      }
   );
   return result;
}

/**
 * Класс с данными про текущую сборку. Для реализации инкрементальной сборки.
 */
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

      // Темы для компиляции less. <Имя темы>: <путь до файла <Имя темы>.less>
      this.styleThemes = {};
   }

   static getLastRunningParametersPath(cacheDirectory) {
      return path.join(cacheDirectory, 'last_build_gulp_config.json');
   }

   async load(cacheDirectory) {
      if (await fs.pathExists(path.join(cacheDirectory, 'builder-info.json'))) {
         logger.debug(`Читаем файлы кеша билдера из директории ${cacheDirectory}`);
         this.runningParameters = await fs.readJSON(StoreInfo.getLastRunningParametersPath(cacheDirectory));

         try {
            const builderInfo = await fs.readJson(path.join(cacheDirectory, 'builder-info.json'));
            this.versionOfBuilder = builderInfo.versionOfBuilder;
            logger.debug(`В кеше versionOfBuilder: ${this.versionOfBuilder}`);
            this.startBuildTime = builderInfo.startBuildTime;
            logger.debug(`В кеше startBuildTime: ${this.startBuildTime}`);
         } catch (error) {
            logger.info({
               message: `Не удалось прочитать файл кеша ${path.join(cacheDirectory, 'builder-info.json')}`,
               error
            });
         }
         try {
            this.inputPaths = await fs.readJson(path.join(cacheDirectory, 'input-paths.json'));
         } catch (error) {
            logger.info({
               message: `Не удалось прочитать файл кеша ${path.join(cacheDirectory, 'input-paths.json')}`,
               error
            });
         }
         try {
            this.dependencies = await fs.readJson(path.join(cacheDirectory, 'dependencies.json'));
         } catch (error) {
            logger.info({
               message: `Не удалось прочитать файл кеша ${path.join(cacheDirectory, 'dependencies.json')}`,
               error
            });
         }
         try {
            this.modulesCache = await readAllFilesByCurrentCacheMeta(cacheDirectory, 'modules-cache');
         } catch (error) {
            logger.info({
               message: `Не удалось прочитать файл кеша ${path.join(cacheDirectory, 'modules-cache.json')}`,
               error
            });
         }
         try {
            const filesWithErrors = await fs.readJson(path.join(cacheDirectory, 'files-with-errors.json'));
            this.filesWithErrors = new Set(filesWithErrors);
         } catch (error) {
            logger.info({
               message: `Не удалось прочитать файл кеша ${path.join(cacheDirectory, 'files-with-errors.json')}`,
               error
            });
         }
         try {
            this.styleThemes = await fs.readJson(path.join(cacheDirectory, 'style-themes.json'));
         } catch (error) {
            logger.info({
               message: `Не удалось прочитать файл кеша ${path.join(cacheDirectory, 'style-themes.json')}`,
               error
            });
         }
      }
   }

   async save(cacheDirectory, logFolder) {
      await fs.outputJson(
         path.join(cacheDirectory, 'builder-info.json'),
         {
            versionOfBuilder: this.versionOfBuilder,
            startBuildTime: this.startBuildTime
         },
         {
            spaces: 1
         }
      );
      await fs.outputJson(
         path.join(cacheDirectory, 'input-paths.json'),
         this.inputPaths,
         {
            spaces: 1
         }
      );
      await fs.outputJson(
         path.join(cacheDirectory, 'dependencies.json'),
         this.dependencies,
         {
            spaces: 1
         }
      );

      /**
       * separate builder cache meta, particularly "modules-cache.json", by
       * appropriating interface modules to reduce RAM overflow to make further
       * debugging processes simpler.
       */
      await pMap(
         Object.keys(this.modulesCache),
         async(currentModule) => {
            await fs.outputJson(
               path.join(cacheDirectory, 'modules-cache', `${currentModule}.json`),
               this.modulesCache[currentModule],
               {
                  spaces: 1
               }
            );
         }
      );
      await fs.outputJson(
         path.join(cacheDirectory, 'files-with-errors.json'),
         [...this.filesWithErrors],
         {
            spaces: 1
         }
      );
      await fs.outputJson(
         path.join(cacheDirectory, 'style-themes.json'),
         this.styleThemes,
         {
            spaces: 1
         }
      );

      await fs.outputJson(
         StoreInfo.getLastRunningParametersPath(cacheDirectory),
         this.runningParameters,
         {
            spaces: 1
         }
      );

      await fs.outputJson(
         path.join(cacheDirectory, 'cache-path.json'),
         {
            lastCacheDirectory: cacheDirectory,
            lastLogFolder: logFolder
         },
         {
            spaces: 1
         }
      );
   }


   /**
    * Получить набор выходных файлов. Нужно чтобы получать разницы между сборками и удалять лишнее.
    * @returns {Set<string>}
    */
   getOutputFilesSet(cachePath, modulesForPatch) {
      const resultSet = new Set();
      for (const filePath in this.inputPaths) {
         if (!this.inputPaths.hasOwnProperty(filePath)) {
            continue;
         }
         for (const outputFilePath of this.inputPaths[filePath].output) {
            // for patch build get only paths for patching modules
            if (modulesForPatch && modulesForPatch.length > 0) {
               const currentModuleName = outputFilePath
                  .replace(cachePath, '')
                  .split('/')
                  .shift();
               if (modulesForPatch.includes(currentModuleName)) {
                  resultSet.add(outputFilePath);
               }
            } else {
               resultSet.add(outputFilePath);
            }
         }
      }
      return resultSet;
   }
}

module.exports = StoreInfo;
