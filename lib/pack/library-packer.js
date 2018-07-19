'use strict';

const
   libPackHelpers = require('./helpers/librarypack'),
   escodegen = require('escodegen'),
   esprima = require('esprima'),
   path = require('path'),
   logger = require('../logger').logger(),
   { traverse } = require('estraverse');


function checkDependencyForExisting(dependencyName, privateDependenciesSet) {
   let existsInSet = false;
   privateDependenciesSet.forEach((dependency) => {
      if (dependency.moduleName === dependencyName) {
         existsInSet = true;
      }
   });
   return existsInSet;
}

function dependencyWalker(
   root,
   libraryName,
   currentDepTree,
   parentDependency,
   currentDependency,
   libraryDependenciesMeta,
   externalDependenciesToPush,
   privateModulesFiles,
   privatePartsForChangesStore,
   result,
   dependenciesTreeError
) {
   let newDepTree;
   if (!currentDepTree.has(currentDependency)) {
      const
         dependencyContent = libPackHelpers.readModuleAndGetParamsNames(
            root,
            libraryName,
            currentDependency,
            libraryDependenciesMeta,
            externalDependenciesToPush,
            privateModulesFiles
         ),
         currentPrivateDependencies = dependencyContent.dependencies.filter((dep) => {
            if (dep === libraryName) {
               logger.error({
                  message: `Cycle library dependency. Parent module: ${currentDependency}`,
                  filePath: `${path.join(root, libraryName)}.js`
               });
               dependenciesTreeError.enabled = true;
            }
            return libPackHelpers.isPrivate(dep);
         });

      newDepTree = new Set([...currentDepTree, currentDependency]);
      if (!checkDependencyForExisting(dependencyContent.moduleName, result)) {
         result.add(dependencyContent);

         // добавляем в список на запись в кэш dependencies. Нужно для инкрементальной сборки
         privatePartsForChangesStore.push(`${dependencyContent.moduleName}.js`);
      }
      if (currentPrivateDependencies.length > 0) {
         currentPrivateDependencies.forEach((childDependency) => {
            dependencyWalker(
               root,
               libraryName,
               newDepTree,
               currentDependency,
               childDependency,
               libraryDependenciesMeta,
               externalDependenciesToPush,
               privateModulesFiles,
               privatePartsForChangesStore,
               result,
               dependenciesTreeError
            );
         });
      }
   } else {
      logger.error({
         message: `Cycle dependency detected: ${currentDependency}. Parent module: ${parentDependency}`,
         filePath: `${path.join(root, libraryName)}.js`
      });
      dependenciesTreeError.enabled = true;
   }
}

function recursiveAnalizeEntry(
   root,
   libraryName,
   libraryDependenciesMeta,
   externalDependenciesToPush,
   privateDependencies,
   privateModulesFiles,
   privatePartsForChangesStore
) {
   const result = new Set();

   /**
    * Не будем ругаться через throw, просто проставим флаг.
    * Это позволит нам полностью проанализировать граф и сразу
    * выдать разработчикам все проблемные места.
    */
   const dependenciesTreeError = {};
   privateDependencies.forEach((dependency) => {
      const currentTreeSet = new Set();
      dependencyWalker(
         root,
         libraryName,
         currentTreeSet,

         // parent module
         libraryName,

         // current dependency
         dependency,
         libraryDependenciesMeta,
         externalDependenciesToPush,
         privateModulesFiles,
         privatePartsForChangesStore,
         result,
         dependenciesTreeError
      );
   });
   if (dependenciesTreeError.enabled) {
      throw new Error('Cycle dependencies detected. See logs.');
   }
   return result;
}

function packCurrentLibrary(root, privatePartsForChangesStore, data, privateModulesFiles) {
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
      externalDependenciesToPush = [];

   let privateDependenciesOrder = [];
   try {
      const privateDependenciesSet = Object.keys(libraryDependenciesMeta).filter(
         dependency => libraryDependenciesMeta[dependency].isLibraryPrivate
      );

      /**
       * рекурсивно по дереву получаем полный набор приватных частей библиотеки,
       * от которых она зависит.
       * @type {Set<any>} в качестве результата нам будет возвращён Set
       */
      privateDependenciesOrder = [...recursiveAnalizeEntry(
         root,
         libraryName,
         libraryDependenciesMeta,
         externalDependenciesToPush,
         privateDependenciesSet,
         privateModulesFiles,
         privatePartsForChangesStore
      )];
   } catch (error) {
      logger.error({
         message: 'Ошибка анализа приватных зависимостей библиотеки. Библиотека упакована не будет!',
         error,
         filePath: `${path.join(root, libraryName)}.js`
      });

      // возвращаем исходную библиотеку для её дальнейшего сохранения в .min файл.
      return data;
   }

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
