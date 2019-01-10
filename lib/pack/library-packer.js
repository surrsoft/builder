'use strict';

const
   libPackHelpers = require('./helpers/librarypack'),
   escodegen = require('escodegen'),
   esprima = require('esprima'),
   path = require('path'),
   logger = require('../logger').logger(),
   pMap = require('p-map'),
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

async function dependencyWalker(
   sourceRoot,
   libraryName,
   currentDepTree,
   parentDependency,
   currentDependency,
   libraryDependenciesMeta,
   externalDependenciesToPush,
   privateModulesCache,
   privatePartsForCache,
   result,
   dependenciesTreeError
) {
   let newDepTree;

   /**
    * Приватные css-зависимости будем пока просить как внешние зависимости.
    * TODO спилить по выполнении задачи https://online.sbis.ru/opendoc.html?guid=0a57d162-b24c-4a9e-9bc2-bac22139b2ee
    */
   if (currentDependency.startsWith('css!')) {
      externalDependenciesToPush.push(currentDependency);
      return;
   }
   if (!currentDepTree.has(currentDependency)) {
      const
         dependencyContent = await libPackHelpers.readModuleAndGetParamsNames(
            sourceRoot,
            libraryName,
            currentDependency,
            libraryDependenciesMeta,
            externalDependenciesToPush,
            privateModulesCache
         ),
         currentPrivateDependencies = dependencyContent.dependencies.filter((dep) => {
            if (dep === libraryName) {
               logger.error({
                  message: `Cycle library dependency. Parent module: ${currentDependency}`,
                  filePath: `${path.join(sourceRoot, libraryName)}.js`
               });
               dependenciesTreeError.enabled = true;
            }
            return libPackHelpers.isPrivate(dep);
         });

      newDepTree = new Set([...currentDepTree, currentDependency]);
      if (!checkDependencyForExisting(dependencyContent.moduleName, result)) {
         result.add(dependencyContent);

         // добавляем в список на запись в кэш dependencies. Нужно для инкрементальной сборки
         privatePartsForCache.push(dependencyContent.moduleName);
      }
      if (currentPrivateDependencies.length > 0) {
         await pMap(
            currentPrivateDependencies,
            async(childDependency) => {
               await dependencyWalker(
                  sourceRoot,
                  libraryName,
                  newDepTree,
                  currentDependency,
                  childDependency,
                  libraryDependenciesMeta,
                  externalDependenciesToPush,
                  privateModulesCache,
                  privatePartsForCache,
                  result,
                  dependenciesTreeError
               );
            },
            {
               concurrency: 10
            }
         );
      }
   } else {
      logger.error({
         message: `Cycle dependency detected: ${currentDependency}. Parent module: ${parentDependency}`,
         filePath: `${path.join(sourceRoot, libraryName)}.js`
      });
      dependenciesTreeError.enabled = true;
   }
}

async function recursiveAnalizeEntry(
   sourceRoot,
   libraryName,
   libraryDependenciesMeta,
   externalDependenciesToPush,
   privateDependencies,
   privateModulesCache,
   privatePartsForCache
) {
   const result = new Set();

   /**
    * Не будем ругаться через throw, просто проставим флаг.
    * Это позволит нам полностью проанализировать граф и сразу
    * выдать разработчикам все проблемные места.
    */
   const dependenciesTreeError = {};
   await pMap(
      privateDependencies,
      async(dependency) => {
         const currentTreeSet = new Set();
         await dependencyWalker(
            sourceRoot,
            libraryName,
            currentTreeSet,

            // parent module
            libraryName,

            // current dependency
            dependency,
            libraryDependenciesMeta,
            externalDependenciesToPush,
            privateModulesCache,
            privatePartsForCache,
            result,
            dependenciesTreeError
         );
      }
   );
   if (dependenciesTreeError.enabled) {
      throw new Error('Cycle dependencies detected. See logs.');
   }
   return result;
}

async function packLibrary(sourceRoot, data, privateModulesCache) {
   const
      privatePartsForCache = [],
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
      privateDependenciesOrder = [...await recursiveAnalizeEntry(
         sourceRoot,
         libraryName,
         libraryDependenciesMeta,
         externalDependenciesToPush,
         privateDependenciesSet,
         privateModulesCache,
         privatePartsForCache
      )];
   } catch (error) {
      logger.error({
         message: 'Ошибка анализа приватных зависимостей библиотеки. Библиотека упакована не будет!',
         error,
         filePath: `${path.join(sourceRoot, libraryName)}.js`
      });

      // возвращаем исходную библиотеку для её дальнейшего сохранения в .min файл.
      return {
         compiled: data
      };
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
                        filePath: `${path.join(sourceRoot, libraryName)}.js`
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

                  /**
                   * в случае если возвращается последовательность операций, оборачиваем его
                   * и присваиваем exports результат выполнения этой последовательности операций
                   * Актуально для ts-конструкций вида "exports = {<перечисление экспортируемых свойств>}"
                   */
                  if (topLevelReturnStatement.returnsType === 'SequenceExpression') {
                     exportsObject = `(${exportsObject})`;
                  }

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
                     .map((dependency) => {
                        const currentDependencyName = dependency.replace(/\/|\?|!/g, '_');
                        libraryDependenciesMeta[dependency].names.push(`typeof ${currentDependencyName} === 'undefined' ? null : ${currentDependencyName}`);
                        if (
                           libPackHelpers.isPrivate(dependency) &&
                           libPackHelpers.isInternalDependency(path.dirname(libraryName), dependency)
                        ) {
                           return `${libraryDependenciesMeta[dependency].names[0]}`;
                        }
                        return libraryDependenciesMeta[dependency].names[0];
                     });

               /**
                * Для каждой приватной части библиотеки обеспечиваем уникальность имени, поскольку
                * импорт 2х разных модулей может компилироваться для typescript в 1 переменную. Нам
                * нужно обеспечить уникальность имён для приватных частей библиотеки.
                */
               const currentDependencyName = dep.moduleName.replace(/\/|\?|!/g, '_');
               libraryDependenciesMeta[dep.moduleName].names.unshift(currentDependencyName);

               functionCallbackBody.body.splice(
                  packIndex,
                  0,
                  esprima.parse(`exports['${dep.moduleName}'] = true;`)
               );
               packIndex++;
               const
                  moduleCode = `var ${currentDependencyName} = function(){var exports = {};\nvar result =` +
                     `(${escodegen.generate(dep.ast)})(${argumentsForClosure});\n` +
                     'if (result instanceof Function) {\n' +
                     'return result;' +
                     '} else {' +
                     'for (var property in result) {\n' +
                     'if (result.hasOwnProperty(property)) {\n' +
                     'exports[property] = result[property];\n' +
                     '}}\n' +
                     '}' +
                     'return exports;\n}();';

               functionCallbackBody.body.splice(
                  packIndex,
                  0,
                  esprima.parse(moduleCode)
               );
               packIndex++;
               let
                  libDependenciesList = libraryDependencies.map(dependency => dependency.value),
                  privateDependencyIndex = libDependenciesList.indexOf(dep.moduleName);

               /**
                * Одна приватная зависимость может быть заимпорчена несколько раз.
                * Например когда делается export нескольких сущностей из 1-го модуля.
                * Поэтому нам нужно вычистить также все найденные дубли.
                */
               while (privateDependencyIndex !== -1) {
                  const currentParameterName = libraryParametersNames[privateDependencyIndex] &&
                     libraryParametersNames[privateDependencyIndex].name;
                  const defaultParameterName = libraryDependenciesMeta[dep.moduleName].names[0];

                  /**
                   * если нашлись дополнительные дублирующие зависимости, то все переменные, с которыми она была
                   * передана в callback, делаем алиасами от самой первой переменной
                   */
                  if (
                     privateDependencyIndex < libraryParametersNames.length &&
                     currentParameterName !== defaultParameterName
                  ) {
                     functionCallbackBody.body.splice(
                        packIndex,
                        0,
                        esprima.parse(`var ${libraryParametersNames[privateDependencyIndex].name} = ${libraryDependenciesMeta[dep.moduleName].names[0]};`)
                     );
                     packIndex++;
                  }

                  // удаляем приватную зависимость из зависимостей библиотеки и её передачу в callback
                  libPackHelpers.deletePrivateDepsFromList(
                     privateDependencyIndex,
                     libraryDependencies,
                     libraryParametersNames
                  );

                  // достаём свежий список зависимостей и аргументов
                  libDependenciesList = libraryDependencies.map(dependency => dependency.value);
                  privateDependencyIndex = libDependenciesList.indexOf(dep.moduleName);
               }
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
   const libraryResult = {
      compiled: escodegen.generate(ast),
      newModuleDependencies: libraryDependencies.map(object => object.value)
   };
   if (privatePartsForCache.length > 0) {
      libraryResult.fileDependencies = privatePartsForCache.map(
         dependency => getSourcePathByModuleName(sourceRoot, privateModulesCache, dependency)
      );
   }
   return libraryResult;
}

/**
 * Возвращает путь до исходного ES файла для анализируемой зависимости.
 * @param {string} sourceRoot - корень UI-исходников
 * @param {array<string>} privateModulesCache - кэш из taskParameters.cache для приватных модулей
 * @param {string} moduleName - имя анализируемой зависимости
 * @returns {string}
 */
function getSourcePathByModuleName(sourceRoot, privateModulesCache, moduleName) {
   let result = null;
   Object.keys(privateModulesCache).forEach((cacheName) => {
      if (privateModulesCache[cacheName].moduleName === moduleName) {
         result = cacheName;
      }
   });

   /**
    * если не нашли исходник для приватной зависимости в esModulesCache,
    * значит приватная зависимость - это js-модуль в ES5 формате.
    */
   if (!result) {
      result = `${path.join(sourceRoot, moduleName)}.js`;
   }
   return result;
}

module.exports = {
   packLibrary
};
