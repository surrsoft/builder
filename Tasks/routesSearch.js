"use strict";

var path = require('path');
var esprima = require('esprima');
var traverse = require('estraverse').traverse;
var
   routesSource = {},
   jsModules;

function getRoutes(script, file) {
   var ast = esprima.parse(script);
   traverse(ast, {
      enter: function (node) {
         //Ищем оператор =
         if (node.type == 'AssignmentExpression' && node.operator == '=') {
            parseAssignment(node.left, node.right, file);
         }
      }
   });
}

function addToSource(file, info) {
   if (!(file in routesSource)) {
      routesSource[file] = {};
      routesSource[file][info.url] = {
         isMasterPage: info.isMasterPage,
         controller: info.controller
      };
   } else if (info.url in routesSource[file]) {
      throw Error(file + ': обнаружено неоднократное переопределение контроллера для урла ' + info.url);
   } else {
      routesSource[file][info.url] = {
         isMasterPage: info.isMasterPage,
         controller: info.controller
      };
   }
}

function checkInContents(key) {
   return {
      isMasterPage: jsModules.indexOf(key.toString().replace('js!', '')) > -1,
      controller: key
   }
}

function parseAssignment(left, right, file) {
   if (!isModuleExports(left)) {
      return
   }

   parseRoutes(right, file);
}

/**
 * Проверяет, соответствует ли левый операнд у "=" конструкции вида module.exports
 */
function isModuleExports(left) {
   return left.type == 'MemberExpression' && left.object &&
          left.object.name == 'module' && left.property && left.property.name == 'exports';
}

/**
 * Принимает правый операнд "="
 * Допустимый тип - объект или синхронная функция.
 */
function parseRoutes(obj, file) {
   if (obj.type == 'ObjectExpression') {
      obj.properties.forEach(function (prop) {
         observeProperty(prop, file);
      });
   } else if (obj.type == 'FunctionExpression') {
      var returnedObjects = [],
         innerFunctionDeclaration = 0,
         innerFunctionExpression = 0;

      /*
       * Если это функция, разберем ее с помощью esprima.
       * Найдем return функции и проверим, является ли возвращаемое значение объектом.
       * Используя счетчик innerFunctionDeclaration, будем понимать, находимся мы в теле интересующей нас функции или функции, объявленной внутри нее.
       * На входе в узел декларации функции увеличиваем innerFunctionDeclaration, на выходе - уменьшаем.
       * Узел с типом ReturnStatement при innerFunctionDeclaration === 0 признаем соответствующим интересующей функции.
       * Поскольку return-ов может быть несколько, складываем их в объект для последующего анализа.
       */
      traverse(obj.body, {
         enter: function (node) {

            if (node.type == 'FunctionDeclaration') {
               innerFunctionDeclaration++;
            }

            if (node.type == 'FunctionExpression') {
               innerFunctionExpression++;
            }

            if (node.type == 'ReturnStatement' && innerFunctionDeclaration === 0 && innerFunctionExpression === 0) {
               if (node.argument && node.argument.type == 'ObjectExpression' && node.argument.properties) {
                  returnedObjects.push(node.argument.properties);
               }
            }
         },
         leave: function (node) {

            if (node.type == 'FunctionDeclaration') {
               innerFunctionDeclaration--;
            }

            if (node.type == 'FunctionExpression') {
               innerFunctionExpression--;
            }
         }
      });

      returnedObjects = returnedObjects.filter(function (propArray) {
         if (propArray) {
            var allPropertiesCorrect = true;
            propArray.forEach(function (prop) {
               var isCorrectProp = observeProperty(prop, file);
               allPropertiesCorrect = allPropertiesCorrect && isCorrectProp;
            });
            return allPropertiesCorrect;
         }
      });

      if (!returnedObjects.length) {
         onError(file);
      }

   } else {
      onError(file);
   }
}

/**
 * Анализирует объект с урлами роутингов.
 * Допустимы 2 вида:
 * {
 *    "/blah1.html": function() {...},
 *    ...
 * }
 *
 * {
 *    "/blah2.html": "js!SBIS3.Blah"
 * }
 *
 * Для первого варианта не заполняем поля isMasterPage и controller.
 * Для второго - заполним controller соответствующим роутингу модулем и isMasterPage, при наличии модуля в contents.json
 * */
function observeProperty(prop, file) {
   if (prop.type == 'Property' && prop.key && prop.value && prop.key.type == 'Literal' &&
      prop.key.value.indexOf && prop.key.value.indexOf('/') == 0) {
      if (prop.value.type != 'Literal') {
         addToSource(file, {
            url: prop.key.value,
            isMasterPage: false,
            controller: null
         })
      } else {
         var
            valueInfo = checkInContents(prop.value.value),
            isMasterPage = valueInfo.isMasterPage,
            controller = valueInfo.controller;

         addToSource(file, {
            url: prop.key.value,
            isMasterPage: isMasterPage,
            controller: controller
         })
      }

      return true;
   }
}

function onError(file) {
   throw Error(path.basename(file) + ': модуль должен возвращать объект с урлами роутингов, начинающихся с "/" или синхронную функцию, которая возвращает такой объект');
}

module.exports = function (grunt) {
   grunt.registerMultiTask('routsearch', 'Searching routes paths', function () {

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается поиск путей роутинга.');

      var root = grunt.option('root') || '',
          app = grunt.option('application') || '',
          rootPath = path.join(root, app),
          sourceFiles = grunt.file.expand({cwd: rootPath}, this.data),
          sourcePath = path.join(rootPath, 'resources', 'routes-info.json'),
          contentsPath = path.join(rootPath, 'resources', 'contents.json'),
          tmp;

      try {
         tmp = JSON.parse(grunt.file.read(contentsPath));
         jsModules = Object.keys(tmp.jsModules);
      } catch (e) {
         grunt.fail.fatal('Некорректный файл contents.json');
      }

      sourceFiles.forEach(function (route) {
         var
            routePath = path.join(rootPath, route),
            text = grunt.file.read(routePath);
         if (text) {
            getRoutes(text, path.relative(root, routePath));
         }
      });

      grunt.file.write(sourcePath, JSON.stringify(routesSource, null, 2));
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Поиск путей роутинга завершен.');
   });
};