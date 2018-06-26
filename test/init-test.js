/* eslint-disable global-require */
'use strict';

try {
   process.on('unhandledRejection', (reason, p) => {
      // eslint-disable-next-line no-console
      console.log(
         "[00:00:00] [ERROR] Критическая ошибка в работе builder'а. ",
         'Unhandled Rejection at:\n',
         p,
         '\nreason:\n',
         reason
      );
   });

   // TODO: разобраться почему объявление gulp после WS не работает
   require('gulp');

   // логгер - глобальный, должен быть определён до инициализации WS
   require('../lib/logger').setGulpLogger();
   require('../gulp/common/node-ws').init();

   const chai = require('chai'),
      chaiAsPromised = require('chai-as-promised');

   chai.use(chaiAsPromised);
   chai.should();
} catch (e) {
   // eslint-disable-next-line no-console
   console.log(`[00:00:00] [ERROR] Исключение при инициализации тестов: ${e.message}`);
   // eslint-disable-next-line no-console
   console.log(`Stack: ${e.stack}`);
   process.exit(1);
}
