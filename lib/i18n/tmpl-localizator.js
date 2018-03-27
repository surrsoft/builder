'use strict';

const
   tmplParser = global.requirejs('View/Builder/Tmpl'),
   configModule = global.requirejs('View/config'),
   logger = require('../../lib/logger').logger(),
   promiseTimeout = require('../../lib/promise-with-timeout');

const resolverControls = function resolverControls(path) {
   return 'tmpl!' + path;
};

async function parseTmpl(tmplMarkup, currentPath, componentsProperties) {
   const tmplParserPromise = new Promise((resolve, reject) => {
      tmplParser.template(tmplMarkup, resolverControls, {
         config: configModule,
         filename: currentPath,
         fromBuilderTmpl: true,
         createResultDictionary: true,
         componentsProperties: componentsProperties
      }).handle(function(traversedObj) {
         resolve(traversedObj);
      }, function(error) {
         reject(error);
      });
   });
   try {
      return await promiseTimeout.promiseWithTimeout(tmplParserPromise, 30000);
   } catch (err) {
      if (err instanceof promiseTimeout.TimeoutError) {
         const error = new promiseTimeout.TimeoutError('Unhandled exception from \'View/Builder/Tmpl/traverse\'! See logs in builder-build-resources!');
         logger.error({
            error: error,
            message: 'Critical ERROR!'
         });
         throw error;
      }
      throw err;
   }
}

module.exports = {
   parseTmpl: parseTmpl
};
