'use strict';

const process = require('process'); //только одна зависимость вне try/catch, т.к. она используется в catch

try {
   //В самом начале проверим версию node. используем минимум возможностей node.js и ES6
   if (process.versions.node.split('.')[0] < 6) {
      // не рискуем выводить через logger
      // eslint-disable-next-line no-console
      console.log('[00:00:00] [ERROR] Builder_0002 Для запуска требуется Node.js v6.0.0 или выше');
      process.exit(1);
   }

   //логгер - прежде всего
   const gulplog = require('gulplog');
   const logger = require('./lib/logger').setGulpLogger(gulplog);

   //ws должен быть вызван раньше чем первый global.requirejs
   const nodeWS = require('./gulp/helpers/node-ws');
   let err = nodeWS.init();
   if (err) {
      logger.error(err);
      process.exit(1);
   }

   const
      gulp = require('gulp'),
      buildTask = require('./gulp/build.js'),
      guardSingleProcessTask = require('./gulp/guard-single-process.js'),
      BuildConfiguration = require('./gulp/classes/build-configuration.js');


   logger.info('Параметры запуска: ' + JSON.stringify(process.argv));

   let config = new BuildConfiguration();
   err = config.load(process.argv);
   if (err) {
      logger.error(err);
      process.exit(1);
   }

   gulp.task('build',
      gulp.series(
         guardSingleProcessTask.lock(config.cachePath),
         buildTask.create(config),
         guardSingleProcessTask.unlock()));

} catch (e) {
   // eslint-disable-next-line no-console
   console.log('[00:00:00] [ERROR] Builder_0001 Необработанное исключение: ' + e.message + '. Stack: ' + e.stack);
   process.exit(1);
}

