'use strict';

const esprima = require('esprima'),
   traverse = require('estraverse').traverse;

/**
 * Допустимый тип right - объект или синхронная функция.
 */
function parseAssignment(assignmentNode, routes) {
   if (!isModuleExports(assignmentNode.left)) {
      return;
   }

   if (assignmentNode.right.type === 'ObjectExpression') {
      assignmentNode.right.properties.forEach(function(prop) {
         observeProperty(prop, routes);
      });
   } else if (assignmentNode.right.type === 'FunctionExpression') {
      let returnedObjects = [],
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
      traverse(assignmentNode.right.body, {
         enter: function(node) {

            if (node.type === 'FunctionDeclaration') {
               innerFunctionDeclaration++;
            }

            if (node.type === 'FunctionExpression') {
               innerFunctionExpression++;
            }

            if (node.type === 'ReturnStatement' && innerFunctionDeclaration === 0 && innerFunctionExpression === 0) {
               if (node.argument && node.argument.type === 'ObjectExpression' && node.argument.properties) {
                  returnedObjects.push(node.argument.properties);
               }
            }
         },
         leave: function(node) {

            if (node.type === 'FunctionDeclaration') {
               innerFunctionDeclaration--;
            }

            if (node.type === 'FunctionExpression') {
               innerFunctionExpression--;
            }
         }
      });

      returnedObjects = returnedObjects.filter(function(propArray) {
         if (propArray) {
            let allPropertiesCorrect = true;
            propArray.forEach(function(prop) {
               const isCorrectProp = observeProperty(prop, routes);
               allPropertiesCorrect = allPropertiesCorrect && isCorrectProp;
            });
            return allPropertiesCorrect;
         }
      });

      if (!returnedObjects.length) {
         throw new Error('Не удалось найти ни одного корректного роутинга в объекте');
      }
   } else {
      throw new Error('Экспортируется не объект и не функция');
   }
}

/**
 * Проверяет, соответствует ли левый операнд у "=" конструкции вида module.exports
 */
function isModuleExports(left) {
   return left.type === 'MemberExpression' && left.object &&
      left.object.name === 'module' && left.property && left.property.name === 'exports';
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
function observeProperty(prop, routes) {
   if (prop.type === 'Property' && prop.key && prop.value && prop.key.type === 'Literal' &&
      prop.key.value.indexOf && prop.key.value.indexOf('/') === 0) {
      if (prop.value.type !== 'Literal') {
         routes[prop.key.value] = {
            controller: null
         };
      } else {
         routes[prop.key.value] = {
            controller: prop.value.value.toString()
         };
      }
      return true;
   }
   return false;
}

function parseRoutes(text) {
   const routes = {};
   const ast = esprima.parse(text);

   traverse(ast, {
      enter: function(node) {
         //Ищем оператор =
         if (node.type === 'AssignmentExpression' && node.operator === '=') {
            parseAssignment(node, routes);
         }
      }
   });

   return routes;
}

//простаявляем флаг isMasterPage
function prepareToSave(routesInfo, jsModules) {
   for (let routesFilePath in routesInfo) {
      if (!routesInfo.hasOwnProperty(routesFilePath)) {
         continue;
      }
      const routesRules = routesInfo[routesFilePath];
      for (let url in routesRules) {
         if (!routesRules.hasOwnProperty(url)) {
            continue;
         }
         const controller = routesRules[url].controller;
         if (controller && typeof controller === 'string') {
            const componentName = controller.replace('js!', '');
            routesRules[url].isMasterPage = jsModules.includes(componentName);
         } else {
            routesRules[url].isMasterPage = false;
         }
      }
   }
}

module.exports = {
   parseRoutes: parseRoutes,
   prepareToSave: prepareToSave
};
