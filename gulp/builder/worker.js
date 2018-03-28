'use strict';

//логгер - прежде всего
require('../../lib/logger').setGulpLogger();

const
   fs = require('fs-extra'),
   workerPool = require('workerpool'),
   buildLess = require('../../lib/build-less'),
   parseJsComponent = require('../../lib/parse-js-component'),
   processingRoutes = require('../../lib/processing-routes');


process.on('unhandledRejection', (reason, p) => {
   //eslint-disable-next-line no-console
   console.log('[00:00:00] [ERROR] Критическая ошибка в работе worker\'а. ', 'Unhandled Rejection at:\n', p, '\nreason:\n', reason);
   process.exit(1);
});

function buildLessJob(paths, resourcePath) {
   const processOneLess = async function(filePath) {
      try {
         const buffer = await fs.readFile(filePath);
         const obj = await buildLess(filePath, buffer.toString(), resourcePath);
         if (!obj.ignoreMessage) {
            const newPath = filePath.replace('.less', '.css');
            await fs.writeFile(newPath, obj.text);
         }
         return {
            path: filePath,
            imports: obj.imports,
            ignoreMessage: obj.ignoreMessage
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
