/* eslint-disable no-sync */
/**
 * Генерирует поток выполнения сборки одного less файла при измении
 * Вызывается из WebStorm, например.
 * @author Бегунов Ал. В.
 */

'use strict';

const path = require('path'),
   gulp = require('gulp'),
   gulpIf = require('gulp-if'),
   os = require('os'),
   fs = require('fs-extra'),
   workerPool = require('workerpool'),
   gulpRename = require('gulp-rename'),
   gulpChmod = require('gulp-chmod'),
   plumber = require('gulp-plumber');

const ChangesStore = require('./classes/changes-store'),
   Configuration = require('./classes/configuration.js'),
   ConfigurationReader = require('../common/configuration-reader'),
   compileLess = require('./plugins/compile-less'),
   filterUnused = require('./plugins/filter-unused');

const logger = require('../../lib/logger').logger(),
   transliterate = require('../../lib/transliterate');

const {
   needSymlink,
   getDirnameForModule,
   generateTaskForLoadChangesStore,
   generateTaskForTerminatePool
} = require('./helpers');

/**
 * Генерирует поток выполнения сборки одного less файла при измении
 * @param {string[]} processArgv массив аргументов запуска утилиты
 * @returns {Undertaker.TaskFunction} gulp задача
 */
function generateBuildWorkflowOnChange(processArgv) {
   // загрузка конфигурации должна быть синхронной, иначе не построятся задачи для сборки модулей
   const config = new Configuration();
   config.loadSync(processArgv);

   const { filePath } = ConfigurationReader.getProcessParameters(processArgv);
   if (!filePath) {
      throw new Error('Не указан параметр --filePath');
   }
   const changesStore = new ChangesStore(config);

   const pool = workerPool.pool(path.join(__dirname, '../common/worker.js'), {

      // Нельзя занимать больше ядер чем есть. Основной процесс тоже потребляет ресурсы
      maxWorkers: os.cpus().length - 1 || 1,
      forkOpts: {
         env: {
            'ws-core-path': getDirnameForModule(config.rawConfig.modules, 'WS.Core')
         }
      }
   });

   // guardSingleProcess пришлось убрать из-за того что WebStorm может вызвать несколько процессов параллельно
   return gulp.series(
      generateTaskForLoadChangesStore(changesStore),
      generateTaskForCheckVersion(changesStore),
      generateTaskForBuildFile(changesStore, config, pool, filePath),
      generateTaskForTerminatePool(pool)
   );
}

function generateTaskForBuildFile(changesStore, config, pool, filePath) {
   let currentModuleInfo;
   let sbis3ControlsPath = '';
   const pathsForImportSet = new Set();
   let filePathInProject = filePath;
   for (const moduleInfo of config.modules) {
      if (!currentModuleInfo) {
         let relativePath = path.relative(moduleInfo.path, filePath);

         // на windows если два файла на разных дисках, то path.relative даёт путь от диска, без ..
         if (!relativePath.includes('..') && !path.isAbsolute(relativePath)) {
            currentModuleInfo = moduleInfo;
         } else {
            // если модуль задан через симлинк, попробуем сопоставить файл и модуль
            const realModulePath = fs.realpathSync(moduleInfo.path);
            relativePath = path.relative(realModulePath, filePath);
            if (!relativePath.includes('..') && !path.isAbsolute(relativePath)) {
               currentModuleInfo = moduleInfo;
               filePathInProject = path.join(moduleInfo.path, relativePath);
            }
         }
      }
      pathsForImportSet.add(path.dirname(moduleInfo.path));
      if (path.basename(moduleInfo.path) === 'SBIS3.CONTROLS') {
         sbis3ControlsPath = moduleInfo.path;
      }
   }

   const pathsForImport = [...pathsForImportSet];
   if (!currentModuleInfo) {
      logger.info(`Файл ${filePathInProject} вне проекта`);
      return function buildModule(done) {
         done();
      };
   }
   return function buildModule() {
      return gulp
         .src(filePathInProject, { dot: false, nodir: true, base: currentModuleInfo.path })
         .pipe(
            plumber({
               errorHandler(err) {
                  logger.error({
                     message: 'Задача buildModule завершилась с ошибкой',
                     error: err,
                     currentModuleInfo
                  });
                  this.emit('end');
               }
            })
         )
         .pipe(compileLess(changesStore, currentModuleInfo, pool, sbis3ControlsPath, pathsForImport))
         .pipe(
            gulpRename((file) => {
               file.dirname = transliterate(file.dirname);
               file.basename = transliterate(file.basename);
            })
         )
         .pipe(filterUnused())
         .pipe(gulpChmod({ read: true, write: true }))
         .pipe(
            gulpIf(
               needSymlink(config, currentModuleInfo),
               gulp.symlink(currentModuleInfo.output),
               gulp.dest(currentModuleInfo.output)
            )
         );
   };
}
function generateTaskForCheckVersion(changesStore) {
   return function checkBuilderVersion(done) {
      if (changesStore.lastStore.versionOfBuilder !== changesStore.currentStore.versionOfBuilder) {
         logger.error(
            `Текущая версия Builder'а (${changesStore.currentStore.versionOfBuilder}) не совпадает с версией, ` +
            `сохранённой в кеше (${changesStore.lastStore.versionOfBuilder}). ` +
            'Вероятно, необходимо передеплоить стенд.'
         );
      }
      done();
   };
}
module.exports = generateBuildWorkflowOnChange;
