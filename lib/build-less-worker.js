'use strict';

//логгер - прежде всего
const gulpLog = require('gulplog');
require('./logger').setGulpLogger(gulpLog);

const workerPool = require('workerpool'),
   fs = require('fs'),
   buildLess = require('./build-less');

process.on('unhandledRejection', (reason, p) => {
   //eslint-disable-next-line no-console
   console.log('[00:00:00] [ERROR] Критическая ошибка в работе builder\'а. ', 'Unhandled Rejection at:\n', p, '\nreason:\n', reason);
});

workerPool.worker({
   buildLess: function(filePath, resourcePath) {
      return new Promise((resolve, reject) => {
         fs.readFile(filePath, async(readError, buffer) => {
            if (readError) {
               reject(readError);
               return;
            }
            try {
               resolve(await buildLess(filePath, buffer.toString(), resourcePath));
            } catch (error) {
               reject(error);
            }
         });
      });
   }
});
