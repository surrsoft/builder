'use strict';

//логгер - прежде всего
const gulpLog = require('gulplog');
require('../../lib/logger').setGulpLogger(gulpLog);

const
   fs = require('fs-extra'),
   async = require('async'),
   workerPool = require('workerpool'),
   buildLess = require('../../lib/build-less'),
   parseJsComponent = require('../../lib/parse-js-component'),
   processingRoutes = require('../../lib/processing-routes');


process.on('unhandledRejection', (reason, p) => {
   //eslint-disable-next-line no-console
   console.log('[00:00:00] [ERROR] Критическая ошибка в работе builder\'а. ', 'Unhandled Rejection at:\n', p, '\nreason:\n', reason);
});

function buildLessJob(paths, resourcePath) {
   return new Promise((resolve, reject) => {
      const results = [];
      const limit = 20; //эмпирически подобранная величина для высокой производительности
      async.eachOfLimit(paths, limit, async(filePath) => {
         try {
            const text = await fs.readFile(filePath);
            const obj = await buildLess(filePath, text, resourcePath);
            const newPath = filePath.replace('.less', '.css');
            await fs.writeFile(newPath, obj.text);
            results.push({
               path: filePath,
               imports: obj.imports
            });
         } catch (error) {
            results.push({
               path: filePath,
               error: { //ошибка нужно передавать обычным объектом, чтобы красиво stack выводился
                  message: error.message,
                  stack: error.stack ? error.stack.toString() : '',
               }
            });
         }
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
   parseJsComponent: parseJsComponent,
   parseRoutes: processingRoutes.parseRoutes,
   buildLess: buildLessJob
});
