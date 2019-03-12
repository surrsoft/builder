'use strict';

const typescript = require('typescript'),
   path = require('path'),
   transliterate = require('../lib/transliterate'),
   helpers = require('../lib/helpers'),
   esprima = require('esprima'),
   escodegen = require('escodegen'),
   { traverse } = require('estraverse'),
   modulePathToRequire = require('../lib/modulepath-to-require.js');

const privateModuleExt = /\.(es|ts|js)$/;
const excludeUrls = ['cdn', 'rtpackage', 'rtpack', 'demo_src'];
function checkForExcludedUrl(dependency) {
   let result = false;
   const normalizedDependency = helpers.removeLeadingSlash(
      dependency.split(/!|\?/).pop()
   );
   excludeUrls.forEach((currentUrl) => {
      if (normalizedDependency.startsWith(currentUrl)) {
         result = true;
      }
   });
   return result;
}

/**
 * get typescript compiler options from saby typescript configuration
 */
const { compilerOptions } = require('saby-typescript/configs/es5.json');

function normalizeDependencies(code, moduleName) {
   const ast = esprima.parse(code, { attachComment: true });
   let newModuleName = '';
   traverse(ast, {
      enter(node) {
         // узел непосредственно дефайна модуля
         if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'define') {
            node.arguments.forEach((argument, index) => {
               switch (argument.type) {
                  case 'ArrayExpression':
                     for (let i = 0; i < argument.elements.length; i++) {
                        const dependency = argument.elements[i].value;

                        let newDependency = dependency;
                        if (privateModuleExt.test(newDependency) && !checkForExcludedUrl(newDependency)) {
                           newDependency = newDependency.replace(privateModuleExt, '');
                        }
                        if (newDependency.startsWith('.')) {
                           newDependency = helpers.unixifyPath(path.join(moduleName, '..', newDependency));
                        }

                        newDependency = modulePathToRequire.getPrettyPath(newDependency);
                        if (newDependency !== dependency) {
                           argument.elements[i] = {
                              type: 'Literal',
                              value: `${newDependency}`,
                              raw: `"${newDependency}"`
                           };
                        }
                     }
                     break;
                  case 'Literal':

                     // убеждаемся что это действительно название модуля, а не callback в виде литерала
                     if (index === 0) {
                        newModuleName = modulePathToRequire.getPrettyPath(helpers.unixifyPath(argument.value));
                        argument.value = `${newModuleName}`;
                        argument.raw = `'${newModuleName}'`;
                     }
                     break;
                  default:
                     break;
               }
            });

            this.break();
         }
      }
   });
   return {
      text: escodegen.generate(ast, { comment: true }),
      moduleName: newModuleName
   };
}

/**
 * Get transpile options in dependence on existing of
 * AMD-module construction(define)
 * @param {string} relativePath - relative path to current module. Starts from moduleName
 * @param {string} moduleName - AMD-formatted name of module
 * @param {string} moduleContent - typescript/ES6+ module content
 */
function getTranspileOptions(relativePath, moduleName, moduleContent) {
   const transpileOptions = {
      compilerOptions,
      moduleName,
      fileName: relativePath
   };
   const defineRegEx = new RegExp(`define\\(['"]${moduleName.replace(/\\/g, '/')}['"]`);
   if (defineRegEx.test(moduleContent)) {
      delete transpileOptions.compilerOptions.module;
   }
   return transpileOptions;
}

/**
 * Compiles ES6+, TS modules into ES5
 * @param {string} relativePath - relative path to current module. Starts from moduleName
 * @param {string} text - typescript/ES6+ module content
 * @returns {Object}
 */
function compileEsAndTs(relativePath, text) {
   const moduleName = transliterate(relativePath).replace(/\.(es|ts)$/, '');
   const transpileOptions = getTranspileOptions(relativePath, moduleName, text);
   const result = typescript.transpileModule(text, transpileOptions);
   return normalizeDependencies(result.outputText, moduleName);
}

module.exports = compileEsAndTs;
