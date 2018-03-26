'use strict';

const
   tmplParser = global.requirejs('View/Builder/Tmpl'),
   configModule = global.requirejs('View/config'),
   logger = require('../../lib/logger').logger(),
   promiseTimeout = require('../../lib/promise-with-timeout');

const resolverControls = function resolverControls(path) {
   return 'tmpl!' + path;
};

function parseTmpl(tmplMarkup, currentPath, componentsProperties) {
   return new Promise(async(resolve, reject) => {
      const tmplParserPromise = new Promise(() => {
         tmplParser.template(tmplMarkup, resolverControls, {
            config: configModule,
            filename: currentPath,
            fromBuilderTmpl: true,
            createResultDictionary: true,
            componentsProperties: componentsProperties
         }).handle(function(traversedObj) {
            resolve(traversedObj);
         }, function(error) {
            logger.error(error.message);
            reject(error);
         });
      });
      try {
         const result = await promiseTimeout.promiseWithTimeout(tmplParserPromise, 30000);
         resolve(result);
      } catch (err) {
         if (err instanceof promiseTimeout.TimeoutError) {
            reject(new promiseTimeout.TimeoutError('Unhandled exception from \'View/Builder/Tmpl/traverse\'! See logs in builder-build-resources!'));
         }
         reject(err);
      }
   });
}

module.exports = {
   parseTmpl: parseTmpl
};
