'use strict';

//логгер - прежде всего
const gulpLog = require('gulplog');
require('../../lib/logger').setGulpLogger(gulpLog);

const
   fs = require('fs'),
   async = require('async'),
   workerPool = require('workerpool'),
   buildLess = require('../../lib/build-less'),
   parseJsComponent = require('../../lib/parse-js-component'),
   generateStaticHtmlForJs = require('../../lib/generate-static-html-for-js'),
   processingRoutes = require('../../lib/processing-routes');


process.on('unhandledRejection', (reason, p) => {
   //eslint-disable-next-line no-console
   console.log('[00:00:00] [ERROR] Критическая ошибка в работе builder\'а. ', 'Unhandled Rejection at:\n', p, '\nreason:\n', reason);
});

function generateStaticHtmlForJsJob() {
   return generateStaticHtmlForJs(...arguments);
}

function parseJsComponentJob() {
   return parseJsComponent(...arguments);
}

function parseRoutesJob() {
   return processingRoutes.parseRoutes(...arguments);
}

function buildLessJob(tasks, resourcePath) {
   return new Promise((resolve, reject) => {
      const results = [];
      const limit = 20; //эмпирически подобранная величина для высокой производительности
      async.eachOfLimit(tasks, limit, function(task, key, callback) {
         fs.readFile(task.path, async(err, buffer) => {
            const finishWithError = (error, prefixForErrorMessage) => {
               let prefix = '';
               if (prefixForErrorMessage) {
                  prefix = prefixForErrorMessage + ': ';
               }
               results.push({
                  path: task.path,
                  error: { //ошибка нужно передавать обычным объектом, чтобы красиво stack выводился
                     message: prefix + error.message,
                     stack: error.stack ? error.stack.toString() : '',
                  }
               });
               return setImmediate(callback);
            };

            if (err) {
               return finishWithError(err, 'Ошибка при чтении файла');
            }
            let obj;
            try {
               obj = await buildLess(task.path, buffer.toString(), resourcePath);
            } catch (error) {
               return finishWithError(error);
            }
            const newPath = task.path.replace('.less', '.css');
            fs.writeFile(newPath, obj.text, (err) => {
               if (err) {
                  return finishWithError(err, `Ошибка при записи файла ${newPath}`);
               }
               results.push({
                  path: task.path,
                  imports: obj.imports
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

workerPool.worker({
   generateStaticHtmlForJs: generateStaticHtmlForJsJob,
   parseJsComponent: parseJsComponentJob,
   parseRoutes: parseRoutesJob,
   buildLess: buildLessJob
});
