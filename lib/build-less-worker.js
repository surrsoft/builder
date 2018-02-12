'use strict';

//логгер - прежде всего
const gulpLog = require('gulplog');
require('./logger').setGulpLogger(gulpLog);

const workerPool = require('workerpool'),
   fs = require('fs'),
   async = require('async'),
   buildLess = require('./build-less');

process.on('unhandledRejection', (reason, p) => {
   //eslint-disable-next-line no-console
   console.log('[00:00:00] [ERROR] Критическая ошибка в работе builder\'а. ', 'Unhandled Rejection at:\n', p, '\nreason:\n', reason);
});

workerPool.worker({
   buildLess: function(tasks, resourcePath) {
      return new Promise((resolve, reject) => {
         const results = [];
         async.eachOfLimit(tasks, 20, function(task, ttt, callback) {
            fs.readFile(task.path, async(err, buffer) => {
               if (err) {
                  results.push({
                     error: err
                  });
                  return setImmediate(callback);
               }
               let obj;
               try {
                  obj = await buildLess(task.path, buffer.toString(), resourcePath);
               } catch (error) {
                  if (error) {
                     results.push({
                        error: error
                     });
                     return setImmediate(callback);
                  }
               }
               const newPath = task.path.replace('.less', '.css');
               fs.writeFile(newPath, obj.text, (err) => {
                  if (err) {
                     results.push({
                        error: err
                     });
                     return setImmediate(callback);
                  }
                  results.push({
                     path: newPath,
                     //imports: obj.imports
                  });
                  setImmediate(callback);
               });
            });
         }, function(err) {
            if (err) {
               reject(err);
            } else {
               resolve(results);
            }
         });
      });
   }
});
