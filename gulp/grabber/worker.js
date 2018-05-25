'use strict';

// логгер - прежде всего
require('../../lib/logger').setGulpLogger();

// ws должен быть вызван раньше чем первый global.requirejs
require('../helpers/node-ws').init();

const fs = require('fs-extra'),
   workerPool = require('workerpool'),
   collectWordsPrimitive = require('../../lib/i18n/collect-words');

let componentsProperties;

process.on('unhandledRejection', (reason, p) => {
   // eslint-disable-next-line no-console
   console.log(
      "[00:00:00] [ERROR] Критическая ошибка в работе worker'а. ",
      'Unhandled Rejection at:\n',
      p,
      '\nreason:\n',
      reason
   );
   process.exit(1);
});

async function collectWords(modulePath, filePath, componentsPropertiesFilePath) {
   if (!componentsProperties) {
      componentsProperties = await fs.readJSON(componentsPropertiesFilePath);
   }
   const text = await fs.readFile(filePath);
   return collectWordsPrimitive(modulePath, filePath, text.toString(), componentsProperties);
}

workerPool.worker({
   collectWords
});
