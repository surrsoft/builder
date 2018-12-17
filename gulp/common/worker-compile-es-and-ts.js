/**
 * Воркер для пула воркеров компиляции ES6 и TS.
 * @author Бегунов Ал. В.
 */

/* eslint-disable no-console */
'use strict';

/**
 * Trying to get worker's working directory.
 * If occurs an error, we will get working
 * directory from node.js main process cwd
 * stashed in workerpool environment
 * @returns {*}
 */
function checkCWDAvailability() {
   try {
      const currentDir = process.cwd();
      return currentDir;
   } catch (error) {
      console.log('cwd lost. Probably directory of current node.js process was removed.');
      return false;
   }
}

if (!checkCWDAvailability()) {
   console.log('Changing worker\'s cwd to node.js main process cwd');
   process.chdir(process.env['main-process-cwd']);
}

// не всегда понятно по 10 записям, откуда пришёл вызов.
Error.stackTraceLimit = 100;

process.on('unhandledRejection', (reason, p) => {
   console.log(
      "[00:00:00] [ERROR] worker's critical error. ",
      'Unhandled Rejection at:\n',
      p,
      '\nreason:\n',
      reason
   );
   process.exit(1);
});

// логгер - прежде всего
require('../../lib/logger').setWorkerLogger();

const
   workerPool = require('workerpool'),
   compileEsAndTs = require('../../lib/compile-es-and-ts'),
   { wrapWorkerFunction } = require('./helpers');

workerPool.worker({
   compileEsAndTs: wrapWorkerFunction(compileEsAndTs)
});
