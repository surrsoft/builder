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

   const fs = require('fs'),
      gulp = require('gulp'),
      logger = require('./lib/logger').logger,
      buildTask = require('./gulpTasks/build.js');

   logger.info('Параметры запуска: ' + JSON.stringify(process.argv));

   //для получения 1 параметра --config не нужна сторонняя библиотека
   let configFile = '';
   process.argv.forEach(value => {
      if (value.startsWith('--config=')) {
         configFile = value.replace('--config=', '');
      }
   });

   if (!fs.existsSync(configFile)) {
      logger.error(3, 'Файл конфигурации не задан или файл не существует, используйте параметр --config');
      process.exit(1);
   }

   let config = {};
   try {
      config = JSON.parse(fs.readFileSync(configFile, {encoding: 'utf-8'}).toString());
   } catch (e) {
      logger.error(4, 'Файл конфигурации не корректен. Он должен представлять собой JSON-документ в кодировке UTF8. Ошибка: ' + e.message);
      process.exit(1);
   }
   if (!config) {
      logger.error(5, 'Файл конфигурации пустой');
   }

   gulp.task('build', gulp.parallel(buildTask(config)));

} catch (e) {
   // eslint-disable-next-line no-console
   console.log('[00:00:00] [ERROR] Builder_0001 Необработанное исключение: ' + e.message + '. Stack: ' + e.stack);
   process.exit(1);
}

