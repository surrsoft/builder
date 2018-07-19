'use strict';

const typescript = require('typescript'),
   path = require('path'),
   transliterate = require('../lib/transliterate'),
   helpers = require('../lib/helpers'),
   esprima = require('esprima'),
   escodegen = require('escodegen'),
   { traverse } = require('estraverse');

const compilerOptions = {
   module: typescript.ModuleKind.AMD,
   target: typescript.ScriptTarget.ES5,
   alwaysStrict: true,
   lib: ['es5', 'es2015', 'scripthost'],
   allowJs: true,
   importHelpers: true,
   moduleResolution: typescript.ModuleResolutionKind.Classic
};

function normalizeDependencies(code, moduleName) {
   const ast = esprima.parse(code);
   let newModuleName;
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
                        if (newDependency.endsWith('.es')) {
                           newDependency = newDependency.replace(/\.es$/, '');
                        }
                        if (newDependency.startsWith('.')) {
                           newDependency = helpers.unixifyPath(path.join(moduleName, '..', newDependency));
                        }
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
                        newModuleName = helpers.unixifyPath(argument.value);
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
      text: escodegen.generate(ast),
      moduleName: newModuleName
   };
}

/**
 * Компилирует ES6+ и TS в ES5
 * @param {string} relativePath относительный путь файла. Начинается с имени модуля
 * @param {string} text текст модуля
 * @returns {Object}
 */
function compileEsAndTs(relativePath, text) {
   const moduleName = transliterate(relativePath).replace(/\.(es|ts)$/, '');
   const result = typescript.transpileModule(text, {
      compilerOptions,
      moduleName,
      fileName: relativePath
   });
   return normalizeDependencies(result.outputText, moduleName);
}

module.exports = compileEsAndTs;
