'use strict';

//const process = require('process'); //только одна зависимость вне try/catch, т.к. она используется в catch

try {
   //В самом начале проверим версию node. используем минимум возможностей node.js и ES6
   if (process.versions.node.split('.')[0] < 8) {
      // не рискуем выводить через logger
      // eslint-disable-next-line no-console
      console.log('[00:00:00] [ERROR] Для запуска требуется Node.js v8.0.0 или выше');
      process.exit(1);
   }

   process.on('unhandledRejection', (reason, p) => {
      //eslint-disable-next-line no-console
      console.log('[00:00:00] [ERROR] Критическая ошибка в работе builder\'а. ', 'Unhandled Rejection at:\n', p, '\nreason:\n', reason);
   });

   //логгер - прежде всего
   const gulplog = require('gulplog');
   const logger = require('./lib/logger').setGulpLogger(gulplog);

   //ws должен быть вызван раньше чем первый global.requirejs
   require('./gulp/helpers/node-ws').init();

   const
      gulp = require('gulp'),
      generateBuildWorkflow = require('./gulp/generate-build-workflow.js');

   logger.debug('Параметры запуска: ' + JSON.stringify(process.argv));

   gulp.task('build', generateBuildWorkflow(process.argv));

} catch (e) {
   // eslint-disable-next-line no-console
   console.log('[00:00:00] [ERROR] Исключение при работе builder\'а: ' + e.message);
   // eslint-disable-next-line no-console
   console.log('Stack: ' + e.stack);
   process.exit(1);
}

