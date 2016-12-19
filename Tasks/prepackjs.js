var path = require('path');
var fs = require('fs');
var complexPlugins = /is!|browser!|browser\?|optional!/g;
var specialPlugins = /preload!/;
var pluginList = ['css', 'js', 'html', 'cdn', 'browser', 'datasource', 'i18n', 'is', 'is-api', 'json', 'native-css', 'normalize', 'optional', 'order', 'preload', 'remote', 'template', 'text', 'tmpl', 'xml'];
var defineRegexp = /define\([\'"][\S]+?,/;
var coreI18nName = 'Core/i18n';
var DEPENDENCY_REPLACER = '_DEPENDENCY_REPLACER';
var jsExtReg = /\.js$/;
var esprima;
var replace;
var escodegen;

var PackStorage = function () {
   this._resolvedNodes = [];
};
PackStorage.prototype.addToResolvedNodes = function (defineName) {
   this._resolvedNodes.push(defineName);
};
PackStorage.prototype.isNodeResolved = function (defineName) {
   return this._resolvedNodes.indexOf(defineName) > -1
};

function getForceCall(value) {
   return value.indexOf('SBIS3.CORE.ServerEventBus/resources/sockjs') > -1
}

function enableLocalization(text) {
   return text += 'for (var i = 0; i < global._i18nStorage.length; i++) {global._i18nStorage[i](defineStorage["' + coreI18nName + '"]);}';
}

function getValue(node, deps, forceCall) {
   var value;
   if (node.type == 'FunctionExpression') {
      var paramsLength = node.params.length;

      value = {
         type: "CallExpression",
         callee: node,
         arguments: deps || []
      }
   } else if (forceCall) {
      value = {
         type: "CallExpression",
         callee: node,
         arguments: []
      }
   } else {
      value = node;
   }
   return value;
}

function getDeps(depArray, moduleDefineName, packStorage) {
   if (depArray.type == 'ArrayExpression') {
      var dependencies = [];
      var depNames = depArray.elements.map(function (depObj) {
         return depObj.value
      });

      for (var i = 0; i < depArray.elements.length; i++) {
         var
            defineName = depArray.elements[i].value,
            defineNameWithoutComplexPlugins = defineName.replace(complexPlugins, ''),
            hasComplexPlugins = complexPlugins.test(defineName),
            hasSpecialPlugins = specialPlugins.test(defineName);

         if (hasComplexPlugins || hasSpecialPlugins) {
            return {
               lazyDepsResolve: true,
               dependencies: [
                  {
                     "type": "Identifier",
                     "name": moduleDefineName + DEPENDENCY_REPLACER
                  }
               ],
               depNames: depNames
            }
         }

         if (defineName.indexOf('css!') > -1) {
            dependencies.push({
               "type": "Literal",
               "value": defineName,
               "raw": defineName
            })
         } else if (defineName.indexOf('i18n!') > -1) {
            dependencies.push({
               "type": "Identifier",
               "name": "rk"
            })
         } else {
            dependencies.push({
               "type": "MemberExpression",
               "computed": true,
               "object": {
                  "type": "Identifier",
                  "name": "defineStorage"
               },
               "property": {
                  "type": "Identifier",
                  "name": "'" + defineName + "'"
               }
            })
         }
      }

      return {
         dependencies: dependencies,
         depNames: depNames
      };
   } else {
      throw new Error(moduleDefineName + ' has incorrect dependencies type');
   }
}

function getNodeToReplace(defineName, val) {
   return {
      "type": "ExpressionStatement",
      "expression": {
         "type": "AssignmentExpression",
         "operator": "=",
         "left": {
            "type": "MemberExpression",
            "computed": true,
            "object": {
               "type": "Identifier",
               "name": "defineStorage"
            },
            "property": {
               "type": "Identifier",
               "name": "'" + defineName + "'"
            }
         },
         "right": val
      }
   }
}

function prepareToReplace(node, packStorage) {
   var
      defineName = node.arguments[0].value,
      deps,
      val,
      nodeToReplace,
      replaceMeta;

   if (node.arguments.length == 2) {
      val = getValue(node.arguments[1], getForceCall(node.arguments[0].value));
      nodeToReplace = getNodeToReplace(defineName, val);
      replaceMeta = {
         defineName: defineName,
         nodeToReplace: nodeToReplace
      };

      packStorage.modules[defineName] = {
         deps: []
      };
   } else if (node.arguments.length == 3) {

      try {
         deps = getDeps(node.arguments[1], defineName, packStorage);
      } catch (e) {
         return e;
      }

      packStorage.modules[defineName] = {
         deps: deps.depNames,
         lazyDepsResolve: deps.lazyDepsResolve
      };

      val = getValue(node.arguments[2], deps.dependencies, getForceCall(node.arguments[0].value));
      nodeToReplace = getNodeToReplace(defineName, val);
      replaceMeta = {
         defineName: defineName,
         nodeToReplace: nodeToReplace
      }
   }
   return replaceMeta;
}

function parseExpression(node, replacedNames, packStorage, ctx, setModified) {
   if (node.callee.type == 'Identifier' && node.callee.name == 'define') {

      if (node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string' && pluginList.indexOf(node.arguments[0].value) == -1) {
         //Будем игнорировать все вложенные ноды дефайна
         ctx.skip();
         var replaceMeta = prepareToReplace(node, packStorage);
         if (replaceMeta && replaceMeta.nodeToReplace) {
            setModified();
            replacedNames.push(replaceMeta.defineName);
            return replaceMeta.nodeToReplace
         } else if (replaceMeta instanceof Error) {
            return replaceMeta
         }
      }
   }
}
function replaceCallExpression(node, replacedNames, packStorage, ctx, setModified) {

   var parsed = parseExpression(node.expression, replacedNames, packStorage, ctx, setModified);
   return !parsed || parsed instanceof Error ? node : parsed;
}

function replaceSequenceExpression(node, replacedNames, packStorage, ctx, setModified) {
   var
      varDeclarations,
      badSequence;

   /*
    * Поскольку нельзя заменить одну ноду двумя, т.е. привести
    * define("Module1", callback1), define("Module2", callback2)
    * к
    * defineStorage["Module1"] = callback1();
    * defineStorage["Module2"] = callback2();
    *
    * то мы можем либо заменить все define-ы, либо не менять ни одного.
    * Таким образом, если вызов parseExpression вернул ошибку, значит где-то не получилось разрешить зависимости,
    * устанавливаем флаг badSequence и оставляем все как есть.
    * */
   varDeclarations = node.expression.expressions.map(function (exp) {
      if (exp.type == 'CallExpression') {
         var
            parsed = parseExpression(exp, replacedNames, packStorage, ctx, setModified),
            toReturn;

         if (!parsed) {
            toReturn = exp;
         } else if (parsed instanceof Error) {
            badSequence = true;
            toReturn = exp;
         } else {
            toReturn = parsed.expression
         }
         return toReturn;
      } else {
         return exp;
      }
   });

   if (!badSequence) {
      node.expression.expressions = varDeclarations;
   }

   return node;
}

function main(text, packStorage) {
   var
      ast,
      res,
      replacedNames = [],
      wasModified;

   if (!defineRegexp.test(text)) {
      return null;
   }

   function setModified() {
      wasModified = true;
   }

   try {
      ast = esprima.parse(text);
   } catch (e) {
      console.error(e.message);
      return null;
   }

   replace(ast, {
      enter: function (node) {
         if (node.type == 'ExpressionStatement' && node.expression) {
            if (node.expression.type == 'CallExpression') {
               return replaceCallExpression(node, replacedNames, packStorage, this, setModified);
            } else if (node.expression.type == 'SequenceExpression') {
               return replaceSequenceExpression(node, replacedNames, packStorage, this, setModified);
            }
         }
      }
   });

   if (wasModified) {
      try {
         res = escodegen.generate(ast);
      } catch (e) {
         console.error('Ошибка генерации кода:', e);
         console.error(text);
         return null;
      }

      //Добавляем дефолтные вызовы define со ссылками на defineStorage, на случай, если кто-то будет звать через requirejs.
      replacedNames.forEach(function (name) {
         res += 'define("' + name + '", function () {return defineStorage["' + name + '"]});';
         if (name == coreI18nName) {
            res = enableLocalization(res);
         }
      });
   } else {
      res = null;
   }

   return res;
}
module.exports = function (grunt) {
   grunt.registerMultiTask('prepackjs', 'Prepacking js-modules', function () {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача prepackjs.');
      var root = grunt.option('root') || '',
         app = grunt.option('application') || '',
         rootPath = path.join(root, app),
         sourceFiles = grunt.file.expand({cwd: rootPath}, this.data.src);

      esprima = require('esprima');
      replace = require('estraverse').replace;
      escodegen = require('escodegen');

      sourceFiles.forEach(function (fPath) {
         var fContent = grunt.file.read(path.join(rootPath, fPath)),
            packStorage = {
               modules: {},
               content: null
            };

         packStorage.content = main(fContent, packStorage);

         if (packStorage.content) {
            grunt.file.write(fPath.replace(jsExtReg, '.esp.json'), JSON.stringify(packStorage));
         }
      });

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача prepackjs выполнена.');
   });
};
