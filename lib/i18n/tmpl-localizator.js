'use strict';

const
   tmplParser = global.requirejs('View/Builder/Tmpl'),
   configModule = global.requirejs('View/config'),
   logger = require('../../lib/logger').logger();

const resolverControls = function resolverControls(path) {
   return 'tmpl!' + path;
};

function parseTmpl(tmplMarkup, currentPath, componentsProperties) {
   return new Promise(function(resolve, reject) {
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
}

module.exports = {
   parseTmpl: parseTmpl
};
