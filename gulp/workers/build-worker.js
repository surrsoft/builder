'use strict';

//логгер - прежде всего
const gulpLog = require('gulplog');
require('../../lib/logger').setGulpLogger(gulpLog);

const
   fs = require('fs-extra'),
   workerPool = require('workerpool'),
   buildLess = require('../../lib/build-less'),
   parseJsComponent = require('../../lib/parse-js-component'),
   processingRoutes = require('../../lib/processing-routes');


process.on('unhandledRejection', (reason, p) => {
   //eslint-disable-next-line no-console
   console.log('[00:00:00] [ERROR] Критическая ошибка в работе builder\'а. ', 'Unhandled Rejection at:\n', p, '\nreason:\n', reason);
});

function buildLessJob(paths, resourcePath) {
   const processOneLess = async function(filePath) {
      try {
         const buffer = await fs.readFile(filePath);
         const obj = await buildLess(filePath, buffer.toString(), resourcePath);
         const newPath = filePath.replace('.less', '.css');
         await fs.writeFile(newPath, obj.text);
         return {
            path: filePath,
            imports: obj.imports
         };
      } catch (error) {
         return {
            path: filePath,
            error: { //ошибка нужно передавать обычным объектом, чтобы красиво stack выводился
               message: error.message,
               stack: error.stack ? error.stack.toString() : '',
            }
         };
      }
   };

   return Promise.all(paths.map(processOneLess));
}

workerPool.worker({
   parseJsComponent: parseJsComponent,
   parseRoutes: processingRoutes.parseRoutes,
   buildLess: buildLessJob
});
