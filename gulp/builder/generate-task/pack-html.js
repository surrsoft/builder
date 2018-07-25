/**
 * Генерация задачи паковки для статических html.
 * @author Бегунов Ал. В.
 */

'use strict';
const gulp = require('gulp'),
   path = require('path'),
   plumber = require('gulp-plumber');

const logger = require('../../../lib/logger').logger(),
   DepGraph = require('../../../packer/lib/dependencyGraph'),
   pluginPackHtml = require('../plugins/pack-html');

/**
 * Генерация задачи паковки для статических html.
 * @param {ChangesStore} changesStore кеш
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {Pool} pool пул воркеров
 * @returns {Undertaker.TaskFunction|function(done)} В debug режиме вернёт пустышку, чтобы gulp не упал
 */
function generateTaskForPackHtml(changesStore, config, pool) {
   if (!config.isReleaseMode) {
      return function skipPackHtml(done) {
         done();
      };
   }
   const depGraph = new DepGraph();
   const tasks = config.modules.map((moduleInfo) => {
      const moduleOutput = path.join(config.rawConfig.output, path.basename(moduleInfo.output));

      // интересны именно файлы на первом уровне вложенности в модулях
      const input = path.join(moduleOutput, '/**/*.html');

      return function packHtml() {
         return gulp
            .src(input, { dot: false, nodir: true })
            .pipe(
               plumber({
                  errorHandler(err) {
                     logger.error({
                        message: 'Задача packHtml завершилась с ошибкой',
                        error: err,
                        moduleInfo
                     });
                     this.emit('end');
                  }
               })
            )
            .pipe(pluginPackHtml(depGraph, config, moduleInfo, pool))
            .pipe(gulp.dest(moduleOutput));
      };
   });

   return gulp.series(
      generateTaskForLoadDG(changesStore, depGraph),
      gulp.parallel(tasks)
   );
}

function generateTaskForLoadDG(changesStore, depGraph) {
   return function load(done) {
      depGraph.fromJSON(changesStore.getModuleDependencies());
      done();
   };
}

module.exports = generateTaskForPackHtml;
