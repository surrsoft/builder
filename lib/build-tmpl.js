'use strict';
const tmplLocalizator = require('../lib/i18n/tmpl-localizator'),
   helpers = require('../lib/helpers');

async function buildTmpl(text, relativeFilePath, componentsProperties) {
   const prettyRelativeFilePath = helpers.removeLeadingSlash(helpers.prettifyPath(relativeFilePath));
   const tmpl = global.requirejs('View/Builder/Tmpl');
   const config = global.requirejs('View/config');
   const templateRender = Object.create(tmpl);
   const traversedObj = await tmplLocalizator.parseTmpl(text, 'resources/' + prettyRelativeFilePath, componentsProperties);
   const tmplFunc = templateRender.func(traversedObj.astResult, {
      config: config,
      filename: 'resources/' + prettyRelativeFilePath,
      fromBuilderTmpl: true
   });

   let templateFunctionStr = `var templateFunction = ${tmplFunc.toString()};`;
   if (tmplFunc.includedFunctions) {
      templateFunctionStr += 'templateFunction.includedFunctions = {};';
   }

   const currentNode = `tmpl!${prettyRelativeFilePath.replace(/\.tmpl$/g, '')}`;

   let deps = [...templateRender.getComponents(text)];
   const depsStr = deps.reduce((accumulator, currentValue, index) => {
      const indexStr = (index + 1).toString();
      return `${accumulator}_deps["${currentValue}"] = deps[${indexStr}];`;
   }, '');

   deps = ['View/Runner/tclosure', ...deps];

   return (
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
   );
}

module.exports = buildTmpl;
