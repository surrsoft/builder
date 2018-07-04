'use strict';

const
   libPackHelpers = require('./helpers/librarypack'),
   escodegen = require('escodegen'),
   esprima = require('esprima'),
   path = require('path'),
   pMap = require('p-map'),
   logger = require('../logger'),
   { traverse } = require('estraverse');

async function packCurrentLibrary(root, data) {
   const
      ast = esprima.parse(data),
      {
         libraryDependencies,
         libraryDependenciesMeta,
         libraryParametersNames,
         functionCallbackBody,
         topLevelReturnStatement,
         exportsDefine,
         libraryName
      } = libPackHelpers.getLibraryMeta(ast),
      privateDependencies = Object.keys(libraryDependenciesMeta).filter(
         dependency => libraryDependenciesMeta[dependency].isLibraryPrivate
      ),
      externalDependenciesToPush = [];

   let privateDependenciesOrder = [];

   /**
    * читаем все приватные модули, что импортирует к себе библиотека, и собираем для
    * дальнейшего использования метаданные - набор зависимостей, callback в формате ast
    * и имя самого приватного модуля.
    */
   await pMap(
      privateDependencies,
      async(dependency) => {
         let result;
         try {
            result = await libPackHelpers.readModuleAndGetParamsNames(
               root,
               libraryName,
               dependency,
               libraryDependenciesMeta,
               externalDependenciesToPush
            );
         } catch (error) {
            logger.warning({
               message: 'Ошибка обработки текущей приватной зависимости для упаковки в библиотеку',
               error,
               filePath: `${path.join(root, dependency)}.js`
            });
         }
         if (result) {
            privateDependenciesOrder.push(result);
         }
      },
      {
         concurrency: 10
      }
   );

   /**
    * сортируем приватные модули между собой, наиболее зависимые от других приватных частей модули
    * будут обьявляться в самом конце, самые независимые вначале.
    */
   privateDependenciesOrder = libPackHelpers.sortPrivateModulesByDependencies(privateDependenciesOrder);

   /**
    * производим непосредственно сами манипуляции с библиотекой:
    * 1) Добавляем в зависимости библиотеки внешние зависимости приватных частей библиотеки, если их нет в списке.
    * 2) Выкидываем из зависимостей библиотеки все приватные её части, уменьшая таким образом Стэк requirejs.
    * 3) Обьявляем сами приватные части библиотеки внутри неё и экспортируем наружу вместе с исходным экспортируемым
    * библиотекой объектом.
    */
   traverse(ast, {
      enter(node) {
         if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'define') {
            const currentReturnExpressions = [];

            libPackHelpers.addExternalDepsToLibrary(
               externalDependenciesToPush,
               libraryDependencies,
               libraryDependenciesMeta,
               libraryParametersNames
            );

            let packIndex;
            if (exportsDefine.position) {
               packIndex = exportsDefine.position + 1;
               if (topLevelReturnStatement) {
                  const returnArgument = topLevelReturnStatement.statement.argument;

                  /**
                   * надо проверить, что возвращается exports, иначе кидать ошибку.
                   */
                  if (escodegen.generate(returnArgument) !== 'exports') {
                     logger.error({
                        message: 'Библиотека в случае использования механизма exports должна возвращать в качестве результата именно exports',
                        filePath: `${path.join(root, libraryName)}.js`
                     });
                  }
                  functionCallbackBody.body.splice(
                     topLevelReturnStatement.position,
                     1
                  );
               }
            } else {
               let exportsObject;

               if (escodegen.generate(functionCallbackBody.body[0]).includes('\'use strict\';')) {
                  packIndex = 1;
               } else {
                  packIndex = 0;
               }

               if (topLevelReturnStatement) {
                  const returnArgument = topLevelReturnStatement.statement.argument;
                  exportsObject = escodegen.generate(returnArgument);
                  functionCallbackBody.body.splice(
                     topLevelReturnStatement.position,
                     1
                  );
               } else {
                  exportsObject = '{}';
               }
               currentReturnExpressions.push(`var exports = ${exportsObject};`);
            }

            privateDependenciesOrder.forEach((dep) => {
               const
                  argumentsForClosure = dep.dependencies
                     .filter((element, index) => (index <= dep.ast.params.length))
                     .map((dependency) => {
                        if (
                           libPackHelpers.isPrivate(dependency) &&
                           libPackHelpers.isInternalDependency(path.dirname(libraryName), dependency)
                        ) {
                           return `${libraryDependenciesMeta[dependency].names[0]}`;
                        }
                        return libraryDependenciesMeta[dependency].names[0];
                     }),
                  [currentDependencyName] = libraryDependenciesMeta[dep.moduleName].names,
                  libDependenciesList = libraryDependencies.map(dependency => dependency.value),
                  privateDependencyIndex = libDependenciesList.indexOf(dep.moduleName),
                  moduleCode = `var ${currentDependencyName} = function(){var exports = {};\n` +
                     `(${escodegen.generate(dep.ast)})(${argumentsForClosure});\n` +
                     'return exports;\n}();';

               libPackHelpers.deletePrivateDepsFromList(
                  privateDependencyIndex,
                  libraryDependencies,
                  libraryParametersNames
               );

               functionCallbackBody.body.splice(
                  packIndex,
                  0,
                  esprima.parse(moduleCode)
               );
               packIndex++;
            });
            functionCallbackBody.body.push(esprima.parse(currentReturnExpressions.join('\n')));
            functionCallbackBody.body.push({
               'type': 'ReturnStatement',
               'argument': {
                  'type': 'Identifier',
                  'name': 'exports'
               }
            });
         }
      }
   });
   return escodegen.generate(ast);
}

module.exports = {
   packCurrentLibrary
};
