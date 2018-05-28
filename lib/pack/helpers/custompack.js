/* eslint-disable indent */
'use strict';

const path = require('path');
const dblSlashes = /\\/g;
const commonPackage = require('../../../packer/lib/commonPackage');
const excludeCore = ['^Core/*', '^Deprecated/*', '^Transport/*'];
const pMap = require('p-map');
const esprima = require('esprima');
const escodegen = require('escodegen');
const traverse = require('estraverse').traverse;
const esReplace = require('estraverse').replace;
const fs = require('fs-extra');

/**
 * Путь до original файла
 * @param {String} path
 * @return {string}
 */
function originalPath(path) {
   return path.indexOf('.original.') > -1 ? path : path.replace(/(\.js)$/, '.original$1');
}

/**
 * Путь до выходного файла
 */
function getOutputFile(packageConfig, applicationRoot, depsTree, isSplittedCore) {
   let
      mDepsPath = depsTree.getNodeMeta(packageConfig.output).path,
      outputFile;

   if (mDepsPath) {
      outputFile = mDepsPath;
   } else {
      outputFile = path.join(path.dirname(packageConfig.path), path.normalize(packageConfig.output));
   }
   if (isSplittedCore && !mDepsPath) {
      outputFile = outputFile.replace(/(\.js)$/, '.min$1');
   }

   return path.join(path.normalize(applicationRoot), outputFile).replace(dblSlashes, '/');
}

/**
 * Экранируем строку для RegExp
 * @param {String} str
 * @return {string}
 */
function escapeRegExp(str) {
   return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

/**
 * Экранируем строку для RegExp без экранирования *, она заменена на .*
 * @param {String} str
 * @return {string}
 */
function escapeRegExpWithoutAsterisk(str) {
   return str.replace(/[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g, '\\$&').replace('*', '.*');
}

/**
 * Формируем RegExp для фильтрации модулей
 * @param {Array} modules
 * @return {RegExp}
 */
function generateRegExp(modules) {
   let regexpStr = '';

   if (!modules || !modules.length) {
      return null;
   }

   modules.forEach(function(module) {
      if (typeof module !== 'string') {
         return;
      }

      if (module.indexOf('*') > -1) {
         regexpStr += (regexpStr ? '|' : '') + '^(.+?!)?(' + escapeRegExpWithoutAsterisk(module) + ')';
      } else {
         regexpStr += (regexpStr ? '|' : '') + '^(.+?!)?(' + escapeRegExp(module) + '$)';
      }
   });

   return new RegExp(`${regexpStr}`);
}

/**
 * Получаем список вершин
 * @param {DepGraph} dg
 * @param {Array} modules
 * @return {Array}
 */
function findAllModules(dg, modules) {
   const nodes = dg.getNodes();
   const regexp = generateRegExp(modules);

   return nodes.filter(function(node) {
      return regexp.test(node);
   });
}

/**
 * Получаем отфильтрованный граф
 * @param {DepGraph} dg
 * @param {Object} cfg
 * @param {String} applicationRoot - полный путь до корня сервиса
 * @return {Array}
 */
function getOrderQueue(dg, cfg, applicationRoot) {
   let excludeCoreReg;

   //если особый пакет(вебинары), то оставляем старый способ паковки
   if (!cfg.includeCore && cfg.modules) {
      cfg.modules.forEach(function(expression) {
         if (!cfg.include.includes(expression)) {
            cfg.include.push(expression);
         }
      });
      excludeCoreReg = generateRegExp(excludeCore);
   }
   const modules = findAllModules(dg, !cfg.includeCore && !cfg.modules ? cfg.include : cfg.modules);
   const include = generateRegExp(cfg.include);
   const exclude = generateRegExp(cfg.exclude);

   const orderQueue = dg.getLoadOrder(modules);

   return commonPackage.prepareOrderQueue(dg, orderQueue, applicationRoot)
      .filter(function(module) {
         return include ? include.test(module.fullName) : true;
      })
      .filter(function(module) {
         return exclude ? !exclude.test(module.fullName) : true;
      })
      .filter(function(module) {
         return excludeCoreReg ? !excludeCoreReg.test(module.fullName) : true;
      });
}

/**
 * Получаем физический путь для названия пакета
 * @param {DepGraph} dg
 * @param {String} currentPackageName - текущее название для пакета
 * @return {String}
 */
function getBundlePath(currentOutput, applicationRoot, wsRoot) {
   currentOutput = currentOutput.replace(applicationRoot.replace(/\\/g, '/'), '');
   if (wsRoot === 'resources/WS.Core') {
      currentOutput = currentOutput.replace(/^ws/, wsRoot);
   }
   return currentOutput
      .replace(/\\/g, '/')
      .replace(/\.js/g, '');
}

/**
 * Проверяет наличие стиля или шаблона в списке на запись
 * @param module - Полное имя модуля(с плагинами)
 * @param orderQueue - список модулей на запись
 */
async function checkForIncludeInOrderQueue(module, orderQueue) {
   const
      moduleWithoutPlugin = module.split('!').pop(),
      founded = {};

   const checkModule = async currentModule => {
      const currentModuleParts = new Set(currentModule.fullName.split('!'));
      if (currentModuleParts.has(moduleWithoutPlugin)) {
         if (currentModuleParts.has('css')) {
            founded.css = true;
         }
         if (currentModuleParts.has('tmpl')) {
            founded.tmpl = true;
         }
         if (currentModuleParts.has('html')) {
            founded.xhtml = true;
         }
      }
   };

   await Promise.all(orderQueue.map(node => checkModule(node)));
   return founded;
}

/**
 * проверяем, сгенерирован ли шаблон и стоит ли его включать в пакет.
 * P.S. эта функция работает исключительно для анонимных шаблонов, которые
 * любят глубоко в callback тянуть через require
 * @param templatePath
 */
async function checkTemplateForAMD(templatePath) {
   const data = await fs.readFile(templatePath, 'utf8');
   return data.indexOf('define(') === 0;
}

/**
 * Генерирует кастомный пакет для requirejs конфигурации.
 * @param {Object} orderQueue - очередь модулей на запись в пакет.
 * @return {Array}
 */
async function generateBundle(orderQueue, cssModulesFromOrderQueue, splittedCore) {
   const
      bundle = [],
      moduleExtReg = /(\.module)?(\.min)?(\.original)?\.js$/,
      modulesToPushToOrderQueue = [];

   /**
    * в bundles непосредственно css должны остаться на случай динамического запроса пакетов
    */
   cssModulesFromOrderQueue.forEach(css => bundle.push(css.fullName));
   await pMap(
      orderQueue,
      async node => {
         const
            isJSModuleWithoutJSPlugin = node.fullName.indexOf('!') === -1 && node.plugin === 'js',
            modulePath = node.fullPath ? node.fullPath : node.moduleYes.fullPath ? node.moduleYes.fullPath : node.moduleNo.fullPath,
            moduleHaveTmpl = await fs.pathExists(modulePath.replace(moduleExtReg, '.tmpl')),
            moduleHaveXhtml = await fs.pathExists(modulePath.replace(moduleExtReg, '.xhtml')),
            moduleHaveCSS = await fs.pathExists(modulePath.replace(moduleExtReg, '.css'));

         if (node.amd) {
            /**
             * Если модуль без плагина js и у него есть шаблон или стиль, мы должны удостовериться,
             * что они также попадут в бандлы и будут запакованы, иначе require будет вызывать
             * кастомный пакет, но с соответствующим расширением
             */
            if (isJSModuleWithoutJSPlugin && (moduleHaveTmpl || moduleHaveXhtml || moduleHaveCSS)) {
               const foundedElements = await checkForIncludeInOrderQueue(node.fullName, orderQueue);
               let config;
               if (moduleHaveTmpl && !foundedElements.tmpl) {
                  config = {
                     fullName: `tmpl!${node.fullName}`,
                     fullPath: modulePath.replace(moduleExtReg, splittedCore ? '.min.tmpl' : '.tmpl'),
                     plugin: 'tmpl'
                  };
                  config.amd = await checkTemplateForAMD(config.fullPath);
                  modulesToPushToOrderQueue.push(config);

               }
               if (moduleHaveXhtml && !foundedElements.xhtml) {
                  config = {
                     fullName: `tmpl!${node.fullName}`,
                     fullPath: modulePath.replace(moduleExtReg, splittedCore ? '.min.xhtml' : '.xhtml'),
                     plugin: 'html',
                     amd: true
                  };
                  config.amd = await checkTemplateForAMD(config.fullPath);
                  modulesToPushToOrderQueue.push(config);
               }
               if (moduleHaveCSS && !foundedElements.css) {
                  /**
                   * Проверяем наш список css на наличие подходящего имени и в случае его
                   * наличия не надо добавлять в orderQueue на запись.
                   */
                  const foundedCSSFromList = cssModulesFromOrderQueue.find(css => css.fullName.includes(`css!${node.fullName}`));
                  if (!foundedCSSFromList) {
                     modulesToPushToOrderQueue.push({
                        fullName: `css!${node.fullName}`,
                        fullPath: modulePath.replace(moduleExtReg, splittedCore ? '.min.css' : '.css'),
                        plugin: 'css'
                     });
                  }
               }
            }
            bundle.push(node.fullName);
         } else if (node.plugin === 'css' || node.plugin === 'text') {
            bundle.push(node.fullName);
         }
      },
      {
         concurrency: 10
      }
   );

   modulesToPushToOrderQueue.forEach(module => orderQueue.push(module));
   return bundle;
}

/**
 * Генерирует список: модуль и путь до пакета, в котором он лежит
 * @param currentBundle - текущий бандл
 * @param pathToBundle - физический путь до бандла
 * @param bundlesRoutingObject - результирующий список
 */
function generateBundlesRouting(currentBundle, pathToBundle) {
   const bundlesRoute = {};
   for (let i = 0; i < currentBundle.length; i++) {
      if (currentBundle[i].indexOf('css!') === -1) {
         bundlesRoute[currentBundle[i]] = pathToBundle;
      }
   }
   return bundlesRoute;
}

/**
 * Проверяем конфигурационный файл на обязательное наличие опции include и чтобы она не была пустым массивом.
 * В случае успеха кладём его в configsArray, иначе в badConfigs.
 * @param {Object} config - json-файл формата name.package.json
 * @param {String} cfgPath - полный путь до данного конфигурационного файла
 * @param {String} applicationRoot - путь до корня
 * @param {Array} badConfigs - json-файлы формата name.package.json, которые будут проигнорированы паковщиком
 * @param {Array} configsArray - корректные json-файлы формата name.package.json
 * @return {Array}
 */
function checkConfigForIncludeOption(config, cfgPath, applicationRoot) {
   config.path = cfgPath.replace(applicationRoot, '');
   return !(config.includeCore || config.include && config.include.length > 0);
}

/**
 * Обходим конфигурационные файлы, складываем все содержащиеся внутри объекты в configsArray
 * Если конфиг плохой, складываем его в badConfigs
 * По каждому объекту будет создан свой пакет.
 * @param {Object} grunt
 * @param {Array} configsFiles - json-файлы формата name.package.json
 * @param {String} applicationRoot - путь до корня
 * @param {Array} badConfigs - json-файлы формата name.package.json, которые будут проигнорированы паковщиком
 * @return {Array}
 */
async function getConfigsFromPackageJson(configPath, applicationRoot) {
   const
      configsArray = [],
      cfgContent = await fs.readJson(configPath),
      packageName = path.basename(configPath);

   if (cfgContent instanceof Array) {
      for (let i = 0; i < cfgContent.length; i++) {
         const cfgObj = cfgContent[i];
         cfgObj.packageName = packageName;
         cfgObj.configNum = i + 1;
         cfgObj.isBadConfig = checkConfigForIncludeOption(cfgObj, configPath, applicationRoot);
         configsArray.push(cfgObj);
      }
   } else {
      cfgContent.packageName = packageName;
      cfgContent.isBadConfig = checkConfigForIncludeOption(cfgContent, configPath, applicationRoot);
      configsArray.push(cfgContent);
   }

   return configsArray;
}

//генерируем параметры, необходимые для генерации пакета без использования множественного define
function generateParamsForPackage(orderQueue) {
   return orderQueue.map(function(currentNodeInString) {
      const
         ast = esprima.parse(currentNodeInString),
         ifStatementIncluded = ast.body[0].type === 'IfStatement',
         currentDepsIndexes = {};
      let deps, moduleName, callBack;

      traverse(ast, {
         enter: function(node) {
            if (node.type == 'CallExpression' && node.callee.type == 'Identifier' && node.callee.name == 'define') {
               node.arguments.forEach(function(argument) {
                  switch (argument.type) {
                     case 'Literal':
                        moduleName = argument.value;
                        break;
                     case 'ArrayExpression':
                        deps = argument.elements.map(function(element, index) {
                           currentDepsIndexes[element.value] = index;
                           return element.value;
                        });
                        break;
                     case 'FunctionExpression':
                        callBack = argument;
                        break;
                     case 'ObjectExpression':
                        //иногда встречаются модули, где в качестве callBack выступает объект
                        callBack = argument;
                        break;
                  }
               });

            }
         }
      });

      return {
         ast: ast,
         deps: deps,
         moduleName: moduleName,
         callBack: callBack,
         ifStatementIncluded: ifStatementIncluded
      };
   });
}

/*
 * Функция для сортировки модулей по зависимостям. Если модуль A из
 * пакета зависит от модуля B из пакета, то модуль B должен быть
 * определён до модуля A, Если встречается внешняя зависимость, то это никак не влияет на модуль.
 */
function sortModulesForDependencies(orderQueue) {
   orderQueue.forEach(function(currentModule) {
      function watcher(dependency, currentDepth, maxDepth) {
         const founded = orderQueue.find(function(module) {
            return module.moduleName === dependency;
         });
         if (founded) {
            maxDepth += 1;
            founded.deps && founded.deps.forEach(function(dep) {
               let depth = watcher(dep, currentDepth + 1, maxDepth);
               maxDepth = depth > currentDepth ? depth : currentDepth;
            });
         }
         return maxDepth;

      }
      currentModule.depth = 0;
      currentModule.deps && currentModule.deps.forEach(function(dep) {
         const maxDepth = watcher(dep, 0, 0);
         currentModule.depth = maxDepth > currentModule.depth ? maxDepth : currentModule.depth;
      });
   });

   //непосредственно сама сортировка
   orderQueue = orderQueue.sort(function(a, b) {
      if (a.depth > b.depth) {
         return 1;
      } else if (a.depth < b.depth) {
         return -1;
      }
      return 0;

   });
   return orderQueue;
}

/*
 * собираем все внешние зависимости, также делаем копию самих зависимостей,
 * которые мы вернём в отсортированный по зависимостям набор модулей.
 */
function collectExternalDependencies(orderQueue) {
   let externalDependencies = [];
   orderQueue.forEach(function(currentModule) {
      //отбираем внешние зависимости, дубликаты откидываем
      currentModule.deps && currentModule.deps.filter(function(dep) {
         const currentIndex = currentModule.deps.indexOf(dep);
         if (typeof dep === 'string') {
            dep = dep.replace(/^is!browser\?|^is!compatibleLayer\?|^is!msIe\?|^browser!/, '');
         }
         currentModule.deps[currentIndex] = dep;
         return orderQueue.filter(function(module) {
            return module.moduleName === dep;
         }).length === 0;
      }).forEach(function(dep) {
         if (!externalDependencies.includes(dep)) {
            externalDependencies.push(dep);
         }
      });
   });
   return externalDependencies;
}

//собирает полный список зависимостей согласно дереву зависимостей от указанной зависимости - точки входа.
function getAllDepsRecursively(dependency, allDeps, orderQueue) {
   const founded = orderQueue.find(function(module) {
      return module.moduleName === dependency;
   });
   if (founded) {
      founded.deps && founded.deps.forEach(function(dep) {
         const result = getAllDepsRecursively(dep, allDeps, orderQueue);
         if (result && !allDeps.includes(dep)) {
            allDeps.push(dep);
         }
      });
   }
   return dependency;

}

//генерируем пакет с использованием нативной формы обьявления модулей взамен define
async function generatePackageToWrite(listOfModules) {
   let resultPackageToWrite = '';
   if (listOfModules) {
      let
         orderQueue = generateParamsForPackage(listOfModules),
         externalDependencies = collectExternalDependencies(orderQueue),
         defineOfModules = '';

      /* Правим структуру модулей. define нельзя делать внутри require. Нужно их вынести , замкнуть с exports и передать каждому define
       * зависимости, чтобы exports назначился и модули правильно задефайнились.
       */
      resultPackageToWrite = `(function(){\nvar global = (function(){ return this || (0, eval)('this'); }());\nvar require = global.requirejs;\nvar exports = {};\nvar deps = [${externalDependencies.map(function(dep) {
         return `'${dep}'`;
      }).join(', ')}];\n`;

      /*если для конкретного модуля помимо явного define существует define
           *при определённом условии, то оставляем только 2й вариант
           * define оборачивается в условие сборщиком, когда данный модуль
           * запрашивают через плагины is!, browser!.
           */
      orderQueue = orderQueue.filter(function(currentModule) {
         return !(!currentModule.ifStatementIncluded && orderQueue.find(function(module) {
            return currentModule.moduleName === module.moduleName && module.ifStatementIncluded;
         }));
      });

      orderQueue = sortModulesForDependencies(orderQueue);

      orderQueue.forEach(function(moduleToWrite) {
         esReplace(moduleToWrite.ast, {
            enter: function(node) {
               if (node.expression) {
                  if (node.expression.type == 'CallExpression' && node.expression.callee.type == 'Identifier' && node.expression.callee.name == 'define') {
                     var
                        generatedCallBack = escodegen.generate(moduleToWrite.callBack),
                        writeForm = `Object.defineProperty(exports, '${moduleToWrite.moduleName}', {\n
                                            configurable: true,\nget: function() {\n
                                            delete exports['${moduleToWrite.moduleName}'];\n
                                            return exports['${moduleToWrite.moduleName}'] = ${generatedCallBack}(${moduleToWrite.deps ? moduleToWrite.deps.map(function(dep) {
                           var
                              moduleInPackage = orderQueue.find(function(module) {
                                 return module.moduleName === dep;
                              }),
                              extDep = externalDependencies.indexOf(dep);

                           return moduleInPackage ? `exports['${moduleInPackage.moduleName}']` : `require${externalDependencies[extDep] === 'require' ? '' : `(deps[${extDep}])`}`;
                        }).filter(function(dep) {
                           return dep;
                        }).join(', ') : ''});\n}\n});\n`;
                     return esprima.parse(writeForm);
                  }
               }
            }
         });
         resultPackageToWrite += `\n${escodegen.generate(moduleToWrite.ast, {format: {compact: true}})}`;
         var allDeps = [];
         moduleToWrite.deps && moduleToWrite.deps.forEach(function(currentDep) {
            var dep = getAllDepsRecursively(currentDep, allDeps, orderQueue);
            if (!allDeps.includes(dep)) {
               allDeps.push(dep);
            }
         });
         defineOfModules += `\ndefine('${moduleToWrite.moduleName}', [${allDeps.map(function(dep) {
            return `'${dep}'`;
         })}], function() {return exports['${moduleToWrite.moduleName}'];});`;
      });
      resultPackageToWrite += defineOfModules;
      resultPackageToWrite += '\n})()';
   }
   return resultPackageToWrite;

}

/**
 * Генерим код для правильного подключения кастомных css-пакетов
 * Аппендим линку с версией для кэширования, и дефайним все css
 * модули пустышками, чтобы они не затянулись отдельно через require
 * TODO надо будет доработать с Никитой, чтобы я не аппендил линки, если он уже зааппендил в момент серверной вёрстки(какой нибудь аттрибут?например cssBundles).
 * @param cssModules - список всех css-модулей
 * @param packagePath - путь до пакета
 * @param buildNumber - номер билда
 * @returns {string}
 */
function generateLinkForCss(cssModules, packagePath, buildNumber) {
   let result =
      '(function(){var linkAppended = false;function generateLink(){' +
      `var linkHref = '/${packagePath}${buildNumber ? `.v${buildNumber}` : ''}.css';` +
      'if(!linkAppended){var links = document.getElementsByClassName("cssBundles");if(links.length > 0){' +
      'links.forEach(function(link){if(link.getAttribute(href) === linkHref){linkAppended = true;}});}}' +
      'if(!linkAppended){var link = document.createElement("link"),head = document.head || document.getElementsByTagName("head")[0];' +
      'link.setAttribute("rel", "stylesheet");link.classList.add("cssBundles");' +
      'link.setAttribute("href", linkHref);link.setAttribute("data-vdomignore", "true");' +
      'head.appendChild(link);linkAppended = true;}}';
   cssModules.forEach(module => {
      result += `define('${module.fullName}', generateLink);`;
   });
   return result + '})();';
}

module.exports = {
   getOrderQueue: getOrderQueue,
   getOutputFile: getOutputFile,
   getConfigsFromPackageJson: getConfigsFromPackageJson,
   getBundlePath: getBundlePath,
   generateBundle: generateBundle,
   generateBundlesRouting: generateBundlesRouting,
   generateLinkForCss: generateLinkForCss,
   originalPath: originalPath,
   generatePackageToWrite: generatePackageToWrite
};
