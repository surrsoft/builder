'use strict';

const path = require('path'),
   fs = require('fs-extra'),
   assert = require('assert'),
   helpers = require('../../lib/helpers'),
   transliterate = require('../../lib/transliterate'),
   packageJson = require('../../package.json'),
   logger = require('../../lib/logger').logger();

/*
структура стора:
{
   modulePath: {
      exist = true; <- может не быть
      files: {
         filePath:{
            lastModified: '12:12:12';
            exist = true; <- может не быть
         }
      }
   }
}
exist не сохранаяется в файл
*/

class StroreInfo {
   constructor() {
      //в случае изменений параметров запуска проще кеш сбросить, чем потом ошибки на стенде ловить. не сбрасываем только кеш json
      this.runningParameters = {};

      //если поменялась версия билдера, могло помянятся решительно всё. и кеш json в том числе
      this.versionOfBuilder = 'unknown'; //unknown используется далее

      //время начала предыдущей сборки. нам не нужно хранить дату изменения каждого файла
      //для сравнения с mtime у файлов
      this.timeLastBuild = 0;

      //чтобы не копировать лишнее
      this.inputPaths = [];
      this.inputLessPaths = [];

      //imports из less файлов для инкрементальной сборки
      //особенность less в том, что они компилируются относительно корня развёрнутого стенда
      this.lessDependencies = {};

      //чтобы знать что удалить
      this.outputPaths = [];
   }

   async load(filePath) {
      try {
         if (await fs.pathExists(filePath)) {
            const obj = await fs.readJSON(filePath);
            this.runningParameters = obj.runningParameters;
            this.versionOfBuilder = obj.versionOfBuilder;
            this.timeLastBuild = obj.timeLastBuild;
            this.inputPaths = obj.inputPaths;
            this.inputLessPaths = obj.inputLessPaths;
            this.lessDependencies = obj.lessDependencies;
            this.outputPaths = obj.outputPaths;
         }
      } catch (error) {
         logger.warning({
            message: `Не удалось прочитать файл кеша ${filePath}`,
            error: error
         });
      }
   }

   save(filePath) {
      return fs.outputJson(filePath, {
         runningParameters: this.runningParameters,
         versionOfBuilder: this.versionOfBuilder,
         timeLastBuild: this.timeLastBuild,
         inputPaths: this.inputPaths,
         inputLessPaths: this.inputLessPaths,
         lessDependencies: this.lessDependencies,
         outputPaths: this.outputPaths
      }, {
         spaces: 3
      });
   }
}

class ChangesStore {
   constructor(config) {
      this.config = config;
      this.lastStore = new StroreInfo();
      this.currentStore = new StroreInfo();
      this.moduleInfoForLess = {};
      this.changedLessFiles = [];
   }

   load() {
      this.currentStore.runningParameters = this.config.rawConfig;
      this.currentStore.versionOfBuilder = packageJson.version;
      this.currentStore.timeLastBuild = new Date().getTime();

      this.filePath = path.join(this.config.cachePath, 'store.json');
      return this.lastStore.load(this.filePath);
   }

   save() {
      return this.currentStore.save(this.filePath);
   }

   async cacheHasIncompatibleChanges() {
      const finishText = 'Кеш и результат предыдущей сборки будут удалены, если существуют.';
      if (this.lastStore.versionOfBuilder === 'unknown') {
         logger.info('Не удалось обнаружить валидный кеш от предыдущей сборки. ' + finishText);
         return true;
      }
      try {
         assert.deepEqual(this.lastStore.runningParameters, this.currentStore.runningParameters);
      } catch (error) {
         logger.info('Параметры запуска builder\'а поменялись. ' + finishText);
         return true;
      }

      //новая версия билдера может быть полностью не совместима
      const isNewBuilder = this.lastStore.versionOfBuilder !== this.currentStore.versionOfBuilder;
      if (isNewBuilder) {
         logger.info('Версия builder\'а не соответствует сохранённому значению в кеше. ' + finishText);
         return true;
      }

      //если нет хотя бы одной папки не оказалось на месте, нужно сбросить кеш
      const promisesExists = [];
      for (const moduleInfo of this.config.modules) {
         promisesExists.push(fs.pathExists(moduleInfo.output));
      }
      const resultsExists = await Promise.all(promisesExists);
      if (resultsExists.includes(false)) {
         logger.info('Как минимум один из результирующих каталогов был удалён. ' + finishText);
         return true;
      }
      return false;
   }

   isFileChanged(filePath, fileMTime, moduleInfo) {
      const prettyPath = helpers.prettifyPath(filePath);

      //кеша не было, значит все файлы новые
      const noCache = !this.lastStore.timeLastBuild;

      //проверка modification time. этой проверки может быть не достаточно в двух слуаях:
      //1. файл вернули из корзины
      //2. файл не корректно был обработан в предыдущей сборке и мы не смогли определить зависимости
      const isModifiedFile = fileMTime.getTime() > this.lastStore.timeLastBuild;

      if (path.extname(filePath) !== '.less') {
         this.currentStore.inputPaths.push(prettyPath);

         return noCache || isModifiedFile ||
            !this.lastStore.inputPaths.includes(prettyPath); //новый файл
      }

      //less билдятся относительно корня стенда, поэтому нужна особая обработка
      const lessRelativePath = path.relative(moduleInfo.path, filePath);
      const lessFullPath = helpers.prettifyPath(path.join(moduleInfo.output, transliterate(lessRelativePath)));

      const isChanged = noCache || isModifiedFile ||
         !this.lastStore.inputLessPaths.includes(lessFullPath); //новый файл

      this.currentStore.inputLessPaths.push(lessFullPath);

      this.moduleInfoForLess[lessFullPath] = moduleInfo;
      if (isChanged) {
         this.changedLessFiles.push(lessFullPath);
      } else {
         if (this.lastStore.lessDependencies.hasOwnProperty(lessFullPath)) {
            this.currentStore.lessDependencies[lessFullPath] = this.lastStore.lessDependencies[lessFullPath];
         }
      }
      return isChanged;
   }

   setErrorForLessFile(filePath) {
      const prettyPath = helpers.prettifyPath(filePath);
      this.currentStore.inputLessPaths = this.currentStore.inputLessPaths.filter(function(item) {
         return item !== prettyPath;
      });
   }

   static getListFilesWithDependents(files, dependencies) {
      const dependents = {};
      for (const filePath in dependencies) {
         if (!dependencies.hasOwnProperty(filePath)) {
            continue;
         }
         for (const dependency of dependencies[filePath]) {
            if (!dependents.hasOwnProperty(dependency)) {
               dependents[dependency] = [];
            }
            dependents[dependency].push(filePath);
         }

      }

      const filesToProcessing = [...files];
      const filesWithDependents = new Set();
      while (filesToProcessing.length > 0) {
         const filePath = filesToProcessing.shift();
         if (!filesWithDependents.has(filePath)) {
            filesWithDependents.add(filePath);
            if (dependents.hasOwnProperty(filePath)) {
               filesToProcessing.unshift(...dependents[filePath]);
            }
         }
      }
      return Array.from(filesWithDependents);
   }

   getChangedLessFiles() {
      return ChangesStore.getListFilesWithDependents(this.changedLessFiles, this.lastStore.lessDependencies);
   }

   getModuleInfoForLess() {
      return this.moduleInfoForLess;
   }

   setDependencies(filePath, dependencies) {
      const prettyPath = helpers.prettifyPath(filePath);
      if (dependencies && prettyPath.endsWith('.less')) {
         this.currentStore.lessDependencies[prettyPath] = dependencies.map(helpers.prettifyPath);
      }
   }

   getListForRemoveFromOutputDir() {
      return [];
   }
}

module.exports = ChangesStore;
