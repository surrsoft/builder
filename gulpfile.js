'use strict';

// const process = require('process'); //только одна зависимость вне try/catch, т.к. она используется в catch

try {
   // В самом начале проверим версию node. используем минимум возможностей node.js и ES6
   if (process.versions.node.split('.')[0] < 8) {
      // не рискуем выводить через logger
      // eslint-disable-next-line no-console
      console.log('[00:00:00] [ERROR] Для запуска требуется Node.js v8.0.0 или выше');
      process.exit(1);
   }

   process.on('unhandledRejection', (reason, p) => {
      // eslint-disable-next-line no-console
      console.log('[00:00:00] [ERROR] Критическая ошибка в работе builder\'а. ', 'Unhandled Rejection at:\n', p, '\nreason:\n', reason);
   });

   // логгер - прежде всего
   const logger = require('./lib/logger').setGulpLogger();

   // ws должен быть вызван раньше чем первый global.requirejs
   require('./gulp/helpers/node-ws').init();

   const gulp = require('gulp');
   logger.debug(`Параметры запуска: ${JSON.stringify(process.argv)}`);

   // т.к. мы строим Workflow на основе файла конфигурации, то нужно отделить build от grabber,
   // чтобы не выполнялись лишние действия
   if (process.argv.includes('build')) {
      const generateBuildWorkflow = require('./gulp/builder/generate-workflow.js');
      gulp.task('build', generateBuildWorkflow(process.argv));
   } else if (process.argv.includes('collectWordsForLocalization')) {
      const generateGrabberWorkflow = require('./gulp/grabber/generate-workflow.js');
      gulp.task('collectWordsForLocalization', generateGrabberWorkflow(process.argv));
   } else {
      logger.error('Используется неизвестная задача. Известные задачи: "build" и "collectWordsForLocalization".');
   }
} catch (e) {
   // eslint-disable-next-line no-console
   console.log(`[00:00:00] [ERROR] Исключение при работе builder'а: ${e.message}`);
   // eslint-disable-next-line no-console
   console.log(`Stack: ${e.stack}`);
   process.exit(1);
}
