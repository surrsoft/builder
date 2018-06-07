'use strict';

const fs = require('fs-extra');

const helpers = require('../lib/helpers'),
   logger = require('../lib/logger').logger(),
   promiseTimeout = require('../lib/promise-with-timeout');

const ViewBuilderTmpl = global.requirejs('View/Builder/Tmpl'),
   ViewConfig = global.requirejs('View/config');

let tmplControlsApplicationRoute = null;

//замены, которые нужны для поддержки ядра WS.
//костыль в /ws/ext/requirejs/config.js
const requireJsSubstitutions = new Map([

   //splittedCore == true
   ['WS.Core/lib/', 'Lib/'],
   ['WS.Core/core/', 'Core/'],

   //splittedCore == false
   ['ws/lib/', 'Lib/'],
   ['ws/core/', 'Core/']
]);

const resolverControls = function resolverControls(path) {
   return 'tmpl!' + path;
};

function getWsRoot(splittedCore) {
   if (splittedCore) {
      return '/resources/WS.Core/';
   } else {
      return '/ws/';
   }
}

async function generateFunction(html, fullPath, componentsProperties) {
   if (html.indexOf('define') === 0) {
      throw new Error(`${fullPath} - не шаблон`);
   }

   const conf = { config: ViewConfig, filename: fullPath };
   const templateRender = Object.create(ViewBuilderTmpl),
      dependencies = [];

   templateRender.getComponents(html).forEach(function(dep) {
      dependencies.push(dep);
   });

   // строю ast-дерево
   const traversedObj = await parseTmpl(html, fullPath, componentsProperties);

   const traversed = traversedObj.astResult;

   // строю функцию по ast-дереву
   const tmplFunc = templateRender.func(traversed, conf);
   return {
      dependencies: dependencies,
      tmplFunc: tmplFunc
   };
}

//relativeFilePath должен начинаться с имени модуля
async function buildTmpl(text, relativeFilePath, componentsProperties) {
   const prettyRelativeFilePath = helpers.removeLeadingSlash(helpers.prettifyPath(relativeFilePath));
   const templateRender = Object.create(ViewBuilderTmpl);
   const traversedObj = await parseTmpl(text, 'resources/' + prettyRelativeFilePath, componentsProperties);

   let resolvedNode = prettyRelativeFilePath.replace(/\.tmpl$/g, '');
   for (const pair of requireJsSubstitutions) {
      if (resolvedNode.startsWith(pair[0])) {
         resolvedNode = resolvedNode.replace(pair[0], pair[1]);
         break;
      }
   }

   if (templateRender.getFile) {
      return promiseTimeout.promiseWithTimeout(new Promise(resolve => {
         templateRender.getFile(text, {
            config: ViewConfig,
            fileName: resolvedNode,
            fromBuilderTmpl: true
         }, function callbackFn(funcText) {
            resolve({
               nodeName: `tmpl!${resolvedNode}`,
               text: funcText
            });
         });
      }), 30000);
   }

   const
      currentNode = `tmpl!${resolvedNode}`,
      tmplFunc = templateRender.func(traversedObj.astResult, {
         config: ViewConfig,
         filename: 'resources/' + prettyRelativeFilePath,
         fromBuilderTmpl: true
      });

   let templateFunctionStr = `var templateFunction = ${tmplFunc.toString()};`;
   if (tmplFunc.includedFunctions) {
      templateFunctionStr += 'templateFunction.includedFunctions = {};';
   }

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

async function buildHtmlTmpl(text, fullPath, relativeFilePath, componentsProperties, splittedCore = true) {
   //не во всех проектах есть *.html.tmpl, не нужно в этих случаях падать, если нет модуля Controls.
   if (!tmplControlsApplicationRoute) {
      global.requirejs('Controls/Application');
      tmplControlsApplicationRoute = global.requirejs('tmpl!Controls/Application/Route');
   }

   let cfg = {};
   const cfgPath = fullPath.replace(/\.html\.tmpl$/, '.html.cfg');
   if (await fs.pathExists(cfgPath)) {
      try {
         cfg = await fs.readJson(cfgPath);
      } catch (error) {
         logger.error({
            message: 'Ошибка при обработке конфигурации шаблона',
            error: error,
            filePath: cfgPath
         });
      }
   }

   const result = await generateFunction(text, relativeFilePath, componentsProperties);
   const tmplFunc = result.tmplFunc.toString();

   const routeResult = tmplControlsApplicationRoute({
      application: 'Controls/Application',
      wsRoot: getWsRoot(splittedCore),
      resourceRoot: '/resources/',
      _options: {
         builder: tmplFunc,
         builderCompatible: cfg.compatible,
         dependencies: result.dependencies.map(v => `'${v}'`).toString()
      }
   });

   if (typeof routeResult === 'string') {
      return routeResult;
   } else {
      return helpers.promisifyDeferred(routeResult);
   }
}

async function parseTmpl(tmplMarkup, currentPath, componentsProperties) {
   const tmplParserPromise = new Promise((resolve, reject) => {
      ViewBuilderTmpl.template(tmplMarkup, resolverControls, {
         config: ViewConfig,
         filename: currentPath,
         fromBuilderTmpl: true,
         createResultDictionary: true,
         componentsProperties: componentsProperties
      }).handle(
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

         //TODO вернуть уровень error, когда будет однозначно понятно, из за какого шаблона свалилось по таймауту.
         logger.warning({
            error: error,
            filePath: currentPath,
            message: 'Critical ERROR!'
         });
         throw error;
      }
      throw err;
   }
}

module.exports = {
   buildTmpl: buildTmpl,
   buildHtmlTmpl: buildHtmlTmpl,
   parseTmpl: parseTmpl
};
