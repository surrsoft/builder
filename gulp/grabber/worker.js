'use strict';

//логгер - прежде всего
const gulpLog = require('gulplog');
require('../../lib/logger').setGulpLogger(gulpLog);

//ws должен быть вызван раньше чем первый global.requirejs
require('../helpers/node-ws').init();

const
   fs = require('fs-extra'),
   workerPool = require('workerpool'),
   collectWordsPrimitive = require('../../lib/i18n/collect-words');

let componentsProperties = {}; //TODO

process.on('unhandledRejection', (reason, p) => {
   //eslint-disable-next-line no-console
   console.log('[00:00:00] [ERROR] Критическая ошибка в работе builder\'а. ', 'Unhandled Rejection at:\n', p, '\nreason:\n', reason);
});

async function collectWords(modulePath, filePath, componentsPropertiesFilePath) {
   if (!componentsProperties) {
      componentsProperties = await fs.readJSON(componentsPropertiesFilePath);
   }
   const text = await fs.readFile(filePath);
   return collectWordsPrimitive(modulePath, filePath, text, componentsProperties);
}

workerPool.worker({
   collectWords: collectWords,
});
