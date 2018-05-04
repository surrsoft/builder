'use strict';

const helpers = require('../lib/helpers'),
   tmplParser = global.requirejs('View/Builder/Tmpl'),
   configModule = global.requirejs('View/config'),
   logger = require('../lib/logger').logger(),
   promiseTimeout = require('../lib/promise-with-timeout');

//замены, которые нужны для поддержки ядра WS.
//костыль в /ws/ext/requirejs/config.js
const requireJsSubstitutions = new Map([
   ['WS.Core/lib/', 'Lib/'],
   ['WS.Core/core', 'Core']
]);

const resolverControls = function resolverControls(path) {
   return 'tmpl!' + path;
};

//relativeFilePath должен начинаться с имени модуля
async function buildTmpl(text, relativeFilePath, componentsProperties) {
   const prettyRelativeFilePath = helpers.removeLeadingSlash(helpers.prettifyPath(relativeFilePath));
   const tmpl = global.requirejs('View/Builder/Tmpl');
   const config = global.requirejs('View/config');
   const templateRender = Object.create(tmpl);
   const traversedObj = await parseTmpl(text, 'resources/' + prettyRelativeFilePath, componentsProperties);
   const tmplFunc = templateRender.func(traversedObj.astResult, {
      config: config,
      filename: 'resources/' + prettyRelativeFilePath,
      fromBuilderTmpl: true
   });

   let templateFunctionStr = `var templateFunction = ${tmplFunc.toString()};`;
   if (tmplFunc.includedFunctions) {
      templateFunctionStr += 'templateFunction.includedFunctions = {};';
   }

   let currentNode = prettyRelativeFilePath.replace(/\.tmpl$/g, '');
   for (const pair of requireJsSubstitutions) {
      if (currentNode.startsWith(pair[0])) {
         currentNode = currentNode.replace(pair[0], pair[1]);
         break;
      }
   }
   currentNode = `tmpl!${currentNode}`;

   let deps = [...templateRender.getComponents(text)];
   const depsStr = deps.reduce((accumulator, currentValue, index) => {
      const indexStr = (index + 1).toString();
      return `${accumulator}_deps["${currentValue}"] = deps[${indexStr}];`;
   }, '');

   deps = ['View/Runner/tclosure', ...deps];

   return {
      nodeName: currentNode,
      text:
      `define("${currentNode}",${JSON.stringify(deps)},function(){` +
      'var deps=Array.prototype.slice.call(arguments);' +
      'var tclosure=deps[0];' +
      'var _deps = {};' +
      `${depsStr}` +
      `${templateFunctionStr}` +
      'templateFunction.stable = true;' +
      `templateFunction.toJSON = function() {return {$serialized$: "func", module: "${currentNode}"}};` +
      'return templateFunction;' +
      '});'
   };
}

async function parseTmpl(tmplMarkup, currentPath, componentsProperties) {
   const tmplParserPromise = new Promise((resolve, reject) => {
      tmplParser
         .template(tmplMarkup, resolverControls, {
            config: configModule,
            filename: currentPath,
            fromBuilderTmpl: true,
            createResultDictionary: true,
            componentsProperties: componentsProperties
         })
         .handle(
            function(traversedObj) {
               resolve(traversedObj);
            },
            function(error) {
               reject(error);
            }
         );
   });
   try {
      return await promiseTimeout.promiseWithTimeout(tmplParserPromise, 30000);
   } catch (err) {
      if (err instanceof promiseTimeout.TimeoutError) {
         const error = new promiseTimeout.TimeoutError(
            'Unhandled exception from \'View/Builder/Tmpl/traverse\'! See logs in builder-build-resources!'
         );
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
   buildTmpl: buildTmpl,
   parseTmpl: parseTmpl
};
