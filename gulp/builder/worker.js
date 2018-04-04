'use strict';

//логгер - прежде всего
require('../../lib/logger').setGulpLogger();

//ws должен быть вызван раньше чем первый global.requirejs
require('../helpers/node-ws').init();

const
   fs = require('fs-extra'),
   workerPool = require('workerpool'),
   buildLess = require('../../lib/build-less'),
   parseJsComponent = require('../../lib/parse-js-component'),
   processingRoutes = require('../../lib/processing-routes'),
   prepareXHTMLPrimitive = require('../../lib/i18n/prepare-xhtml');

let componentsProperties;

process.on('unhandledRejection', (reason, p) => {
   //eslint-disable-next-line no-console
   console.log('[00:00:00] [ERROR] Критическая ошибка в работе worker\'а. ', 'Unhandled Rejection at:\n', p, '\nreason:\n', reason);
   process.exit(1);
});

async function prepareXHTML(text, componentsPropertiesFilePath) {
   if (!componentsProperties) {
      componentsProperties = await fs.readJSON(componentsPropertiesFilePath);
   }
   return prepareXHTMLPrimitive(text, componentsProperties);
}

workerPool.worker({
   parseJsComponent: parseJsComponent,
   parseRoutes: processingRoutes.parseRoutes,
   buildLess: buildLess,
   prepareXHTML: prepareXHTML
});
