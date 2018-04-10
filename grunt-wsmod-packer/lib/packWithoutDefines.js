"use strict";

var
   path = require('path'),
   fs = require('fs'),
   esprima = require('esprima'),
   replace = require('estraverse').replace,
   escodegen = require('escodegen'),
   complexPlugins = /is!|browser!|browser\?/g,
   specialPlugins = /preload!/,
   pluginList = ['css', 'js', 'html', 'cdn', 'browser', 'datasource', 'i18n', 'is', 'is-api', 'json', 'native-css', 'normalize', 'optional', 'order', 'preload', 'remote', 'template', 'text', 'tmpl', 'xml'],
   defineRegexp = /define\([\'"][\S]+?,/,
   coreI18nName = 'Core/i18n';

function getForceCall(value) {
   return value.indexOf('SBIS3.CORE.ServerEventBus/resources/sockjs') > -1
}

function enableLocalization(text) {
   return text += 'for (var i = 0; i < global._i18nStorage.length; i++) {global._i18nStorage[i](defineStorage["' + coreI18nName + '"]);}';
}

/**
 * Принимает коллбек и зависимости define-а.
 * Возвращает коллбек, приведенный к формату самовызывающейся функции со значениями, соответствующими аргументам.
 * */
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

/**
 * Перебирает объект с зависимостями define.
 * 1. Если зависимость содержит css!, то считаем, что она разрешена.
 * 2. Если зависимость была успешно запакована без define ранее, то меняем ее таким образом:
 *    строка "Dependency" заменяется на defineStorage["Dependency"]
 * 3. Если зависимость не была запакована, то попытаемся проверить, не запаковали ли ее без плагинов is!,browser!,browser\? или preload!
 *    Если она была запакована, то убираем плагины и действуем, как в пункте 2.
 * 4. Если и это не помогло, то зависимость неразрешима. Кидаем ошибку, оставляем define как есть.
 * */
function getDeps(depArray, packStorage) {
   if (depArray.type == 'ArrayExpression') {
      var deps = [];
      for (var i = 0; i < depArray.elements.length; i++) {
         var
            defineName = depArray.elements[i].value,
            defineNameWithoutComplexPlugins = defineName.replace(complexPlugins, '');

         if (defineName.indexOf('css!') > -1) {
            deps.push({
               "type": "Literal",
               "value": defineName,
               "raw": defineName
            })
         } else if (defineName.indexOf('i18n!') > -1) {
            deps.push({
               "type": "Identifier",
               "name": "rk"
            })
         } else if (packStorage.isNodeResolved(defineName)) {//isNodeResolved(defineName, resolvedNodes)) {
            deps.push({
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
         } else if (packStorage.isNodeResolved(defineNameWithoutComplexPlugins)) {//isNodeResolved(defineNameWithoutComplexPlugins, resolvedNodes)) {
            deps.push({
               "type": "MemberExpression",
               "computed": true,
               "object": {
                  "type": "Identifier",
                  "name": "defineStorage"
               },
               "property": {
                  "type": "Identifier",
                  "name": "'" + defineNameWithoutComplexPlugins + "'"
               }
            })
         } else if (specialPlugins.test(defineNameWithoutComplexPlugins)) {
            deps.push({
               "type": "CallExpression",
               "callee": {
                  "type": "MemberExpression",
                  "computed": true,
                  "object": {
                     "type": "Identifier",
                     "name": "defineStorage"
                  },
                  "property": {
                     "type": "Literal",
                     "value": "preloadFunc",
                     "raw": "'preloadFunc'"
                  }
               },
               "arguments": [
                  {
                     "type": "Identifier",
                     "name": "'" + defineNameWithoutComplexPlugins + "'"
                  }
               ]
            })
         } else {
            throw new Error('Can\'t resolve dependency: ' + defineName + ' of module ');
         }
      }

      return deps;
   }
}

function getNodeToReplace(defineName, val, packStorage) {
   packStorage.addToResolvedNodes(defineName);
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

/**
 * Превращает ноду вида
 * define("ModuleName", ["Dep1", "Dep2"], callback)
 * в
 * defineStorage["ModuleName"] = callback(defineStorage["Dep1"], defineStorage["Dep2"]);
 * И возвращает объект, содержащий ModuleName и новую ноду.
 */
function prepareToReplace(node, packStorage) {
   var
      defineName = node.arguments[0].value,
      deps,
      val,
      nodeToReplace,
      replaceMeta;

   if (node.arguments.length == 2) {
      val = getValue(node.arguments[1], getForceCall(node.arguments[0].value));
      nodeToReplace = getNodeToReplace(defineName, val, packStorage);
      replaceMeta = {
         defineName: defineName,
         nodeToReplace: nodeToReplace
      }
   } else if (node.arguments.length == 3) {
      try {
         deps = getDeps(node.arguments[1], packStorage);
      } catch (e) {
         return e;
      }

      val = getValue(node.arguments[2], deps, getForceCall(node.arguments[0].value));
      nodeToReplace = getNodeToReplace(defineName, val, packStorage);
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
         //Если нода для замены успешно получена, то помечаем этот define как разрешенный и возвращаем полученную ноду.
         //Если вернулась ошибка в разборе зависимостей, возвращаем ее. Нужно в replaceSequenceExpression.
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

/**
 * Замена последовательности define-ов вида
 * define("Module1", callback1), define("Module2", callback2)
 * на
 * defineStorage["Module1"] = callback1(), defineStorage["Module2"] = callback2();
 * */
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
      return text;
   }

   function setModified() {
      wasModified = true;
   }

   try {
      ast = esprima.parse(text);
   } catch (e) {
      console.error(e.message);
      throw e;
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
      res = escodegen.generate(ast);

      //Добавляем дефолтные вызовы define со ссылками на defineStorage, на случай, если кто-то будет звать через requirejs.
      replacedNames.forEach(function (name) {
         res += 'define("' + name + '", function () {return defineStorage["' + name + '"]});';
         if (name == coreI18nName) {
            res = enableLocalization(res);
         }
      });
   } else {
      res = text;
   }

   return res;
}

module.exports = {
   main: main
};