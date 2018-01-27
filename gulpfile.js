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

   const
      gulp = require('gulp'),
      logger = require('./lib/logger').logger,
      buildTask = require('./gulpTasks/build.js'),
      guardSingleProcessTask = require('./gulpTasks/guard-single-process.js'),
      BuildConfiguration = require('./gulpTasks/helpers/build-configuration.js'),
      nodeWS = require('./gulpTasks/helpers/node-ws');

   logger.info('Параметры запуска: ' + JSON.stringify(process.argv));

   let config = new BuildConfiguration();
   let err = config.load(process.argv);
   if (err) {
      logger.error(err, 3);
      process.exit(1);
   }

   err = nodeWS.init();
   if (err) {
      logger.error(err, 4);
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

