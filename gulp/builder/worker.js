'use strict';

//логгер - прежде всего
require('../../lib/logger').setGulpLogger();

const
   workerPool = require('workerpool'),
   buildLess = require('../../lib/build-less'),
   parseJsComponent = require('../../lib/parse-js-component'),
   processingRoutes = require('../../lib/processing-routes');


process.on('unhandledRejection', (reason, p) => {
   //eslint-disable-next-line no-console
   console.log('[00:00:00] [ERROR] Критическая ошибка в работе worker\'а. ', 'Unhandled Rejection at:\n', p, '\nreason:\n', reason);
   process.exit(1);
});

workerPool.worker({
   parseJsComponent: parseJsComponent,
   parseRoutes: processingRoutes.parseRoutes,
   buildLess: buildLess
});
