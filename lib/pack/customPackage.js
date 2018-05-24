/* eslint-disable no-unlimited-disable*/
/* eslint-disable */
//sorry about that ¯\_(ツ)_/¯

'use strict';

const path = require('path');
const async = require('async');
const dblSlashes = /\\/g;
const commonPackage = require('../../packer/lib/commonPackage');
const excludeCore = ['^Core/*', '^Deprecated/*', '^Transport/*'];
const logger = require('../logger').logger();
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
 * @param {String} output
 * @param {String} applicationRoot
 * @param {DepGraph} dg
 * @return {string}
 */
function getOutputFile(packageConfig, applicationRoot, depsTree, bundlesOptions) {
   let
      mDepsPath = depsTree.getNodeMeta(packageConfig.output).path,
      outputFile;

   if (mDepsPath) {
      outputFile = mDepsPath;
   } else {
      outputFile = path.join(path.dirname(packageConfig.path), path.normalize(packageConfig.output));
   }
   if (bundlesOptions.splittedCore && !mDepsPath) {
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
         regexpStr += (regexpStr ? '|' : '') + '(' + escapeRegExpWithoutAsterisk(module) + ')';
      } else {
         regexpStr += (regexpStr ? '|' : '') + '(' + escapeRegExp(module) + '$)';
      }
   });

   return new RegExp(`^(.+?!)?${regexpStr}`);
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
async function generateBundle(orderQueue, splittedCore) {
   const
      bundle = [],
      moduleExtReg = /(\.module)?(\.min)?(\.original)?\.js$/,
      modulesToPushToOrderQueue = [];

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
                  modulesToPushToOrderQueue.push({
                     fullName: `css!${node.fullName}`,
                     fullPath: modulePath.replace(moduleExtReg, splittedCore ? '.min.css' : '.css'),
                     plugin: 'css'
                  });
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

module.exports = {
   getOrderQueue: getOrderQueue,
   getOutputFile: getOutputFile,
   getConfigsFromPackageJson: getConfigsFromPackageJson,
   getBundlePath: getBundlePath,
   generateBundle: generateBundle,
   generateBundlesRouting: generateBundlesRouting,
   originalPath: originalPath
};
