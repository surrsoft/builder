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

      //
      this.dependencies = {};

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
            this.dependencies = obj.dependencies;
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
         dependencies: this.dependencies,
         outputPaths: this.outputPaths
      }, {
         spaces: 3
      });
   }

   addFile(filePath) {
      this.inputPaths.push(filePath);
   }
}

class ChangesStore {
   constructor() {
      this.lastStore = new StroreInfo();
      this.currentStore = new StroreInfo();
      this.moduleInfoForLess = {};
      this.changedLessFiles = [];
   }

   load(config) {
      this.currentStore.runningParameters = config.rawConfig;
      this.currentStore.versionOfBuilder = packageJson.version;
      this.currentStore.timeLastBuild = new Date().getTime();

      this.filePath = path.join(config.cachePath, 'store.json');
      return this.lastStore.load(this.filePath);
   }

   save() {
      return this.currentStore.save(this.filePath);
   }

   cacheHasIncompatibleChanges() {
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
      const isNewBuilder = this.lastStore.versionOfBuilder !== this.currentStore.versionOfBuilder;
      if (isNewBuilder) {
         logger.info('Версия builder\'а не соответствует сохранённому значению в кеше. ' + finishText);
      }
      return isNewBuilder;
   }

   isFileChanged(filePath, fileMTime, moduleInfo) {
      const prettyPath = helpers.prettifyPath(filePath);
      this.currentStore.addFile(prettyPath);

      const isChanged =
         !this.lastStore.timeLastBuild || //кеша не было
         fileMTime.getTime() > this.lastStore.timeLastBuild || //изменённый файл
         !this.lastStore.inputPaths.includes(prettyPath); //новый файл

      if (path.extname(filePath) === '.less') {
         const lessRelativePath = path.relative(moduleInfo.path, filePath);
         const lessFullPath = path.join(moduleInfo.output, transliterate(lessRelativePath));
         this.moduleInfoForLess[lessFullPath] = moduleInfo;
         if (isChanged) {
            this.changedLessFiles.push(lessFullPath);
         }
      }
      if (!isChanged) {
         if (this.lastStore.dependencies.hasOwnProperty(prettyPath)) {
            this.currentStore.dependencies[prettyPath] = this.lastStore.dependencies[prettyPath];
         }
      }
      return isChanged;
   }

   static getListFilesWithDependents(files, dependencies) {
      const dependents = {};
      for (const filePath in dependencies) {
         if (!dependencies.hasOwnProperty(filePath)) {
            continue;
         }
         for (const dependency of dependencies[filePath]) {
            if (!dependents.hasOwnProperty(dependency)) {
               dependents[dependency] = new Set();
            }
            dependents[dependency].add(filePath);
         }

      }

      const filesToProcessing = files.slice();
      const filesWithDependents = new Set();
      while (filesToProcessing.length > 0) {
         const filePath = filesToProcessing.shift();
         if (!filesWithDependents.has(filePath)) {
            filesWithDependents.add(filePath);
            if (dependents.hasOwnProperty(filePath)) {
               filesToProcessing.unshift(...Array.from(dependents[filePath]));
            }
         }
      }
      return Array.from(filesWithDependents);
   }

   getChangedLessFiles() {
      return ChangesStore.getListFilesWithDependents(this.changedLessFiles, this.lastStore.dependencies);
   }

   getModuleInfoForLess() {
      return this.moduleInfoForLess;
   }

   setDependencies(filePath, dependencies) {
      const prettyPath = helpers.prettifyPath(filePath);
      if (dependencies) {
         this.currentStore.dependencies[prettyPath] = dependencies.map(helpers.prettifyPath);
      }
   }

}

module.exports = ChangesStore;
