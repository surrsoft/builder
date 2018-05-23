/* eslint-disable no-invalid-this */
'use strict';

const async = require('async');
const path = require('path');
const modDeps = require('./../lib/moduleDependencies');
const packHTML = require('./lib/packHTML');
const packOwnDeps = require('./lib/pack-own-deps');
const customPackage = require('./lib/customPackage');
const makeDependenciesGraph = require('./lib/collectDependencies');
const packCSS = require('./lib/packCSS').gruntPackCSS;
const packJS = require('./lib/packJS');
const logger = require('../../lib/logger').logger();

const isDemoModule = /ws\/lib\/Control\/\w+\/demo\//i;
const badConfigs = [];
const bundlesOptions = {
   bundles: {},
   modulesInBundles: {},
   intersects: {},
   outputs: {}
};

/**
 * Сбор зависимостей модулей
 * @param grunt
 * @return {Function}
 */
function gruntCollectDependencies(grunt) {
   return function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача сбора зависимостей.');

      let root = this.data.root,
         application = this.data.application,
         applicationRoot = path.join(root, application),
         taskDone = this.async(),
         jsFiles = [];

      const sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);
      sourceFiles.sort();
      sourceFiles
         .filter(function isDemo(pathToSource) {
            return !isDemoModule.test(pathToSource);
         })
         .forEach(function(pathToSource) {
            jsFiles.push(path.join(applicationRoot, pathToSource));
         });

      makeDependenciesGraph(grunt, root, applicationRoot, jsFiles, function(err, jsonGraph) {
         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача сбора зависимостей выполнена.');
         if (err) {
            taskDone(err);
         } else {
            grunt.file.write(modDeps.getModuleDependenciesPath(applicationRoot), jsonGraph);
            taskDone();
         }
      });
   };
}

/**
 * Паковка модулей для статических html
 * @param grunt
 * @return {Function}
 */
function gruntPackModules(grunt) {
   return function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача паковки зависимостей.');

      let root = this.data.root,
         application = this.data.application,
         applicationRoot = path.join(root, application),
         done = this.async(),
         htmlFiles = [],
         taskDone, dg;

      taskDone = function() {
         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача паковки зависимостей выполнена.');
         done();
      };

      if (!modDeps.checkModuleDependenciesSanity(applicationRoot, taskDone)) {
         return;
      }

      dg = modDeps.getDependencyGraph(applicationRoot);

      const sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);
      sourceFiles.forEach(function(pathToSource) {
         htmlFiles.push(path.join(applicationRoot, pathToSource));
      });

      packHTML(grunt, dg, htmlFiles, this.data.packages, root, application, taskDone);
   };
}

/**
 * Паковка собственных зависимостей
 */
function gruntPackOwnDependencies() {
   return async function gruntPackOwnDependenciesTask() {
      logger.debug('Запускается задача паковки собственных зависимостей.');

      const root = this.data.root,
         applicationRoot = path.join(root, this.data.application),
         done = this.async();

      if (!modDeps.checkModuleDependenciesSanity(applicationRoot, done)) {
         return;
      }

      const dg = modDeps.getDependencyGraph(applicationRoot);

      // Передаем root, чтобы относительно него изменялись исходники в loaders
      await packOwnDeps(dg, root, applicationRoot, this.data.splittedCore);

      logger.debug('Задача паковки собственных зависимостей выполнена.');
      done();
   };
}

function saveBundlesForEachModule(grunt, applicationRoot) {
   Object.keys(bundlesOptions.bundles).forEach(function(currentBundle) {
      let
         bundlePath = path.normalize(path.join(applicationRoot, `${currentBundle.match(/^resources\/[^/]+/)}`, 'bundlesRoute.json')),
         currentModules = bundlesOptions.bundles[currentBundle],
         bundleRouteToWrite = grunt.file.exists(bundlePath) ? JSON.parse(grunt.file.read(bundlePath)) : {};

      currentModules.forEach(function(node) {
         if (node.indexOf('css!') === -1) {
            bundleRouteToWrite[node] = currentBundle;
         }
      });
      grunt.file.write(bundlePath, JSON.stringify(bundleRouteToWrite));
   });
}

function getNameSpaces(intersects) {
   let
      namespaces = {},
      currentNamespace,
      nameWithoutSlash;
   intersects.forEach(function(moduleName) {
      nameWithoutSlash = moduleName.split(/\?|!/).pop().split('/')[0].split('.');
      if (nameWithoutSlash.length > 2) {
         currentNamespace = [nameWithoutSlash[0], nameWithoutSlash[1]].join('.');
      } else {
         currentNamespace = nameWithoutSlash.join('.');
      }
      namespaces[currentNamespace] = 1;
   });
   return Object.keys(namespaces);

}

/**
 * Пользовательская паковка
 * @param grunt
 * @return {Function}
 */
function gruntCustomPack(grunt) {
   return function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача создания кастомных пакетов.');

      let
         root = this.data.root,
         applicationRoot = path.join(root, this.data.application),
         configsFiles = [],
         done = this.async(),
         dblSlashes = /\\/g,
         bundlesPath = 'ext/requirejs',
         wsRoot = grunt.file.exists(applicationRoot, 'resources/WS.Core') ? 'resources/WS.Core' : 'ws',
         bundlesRoutePath,
         taskDone, dg, configsArray, generateIntersectsConfig, collectDepsAndIntersectsDone,
         deleteIntersectsFromPackages, startCreateCustomPacks;

      generateIntersectsConfig = function() {
         let
            namespacesForConfigs = {},
            intersects = Object.keys(bundlesOptions.intersects),
            configPath = '';

            //Генерим для неймспейсов orderQueue и создаём для них конфигурации для кастомной паковки
         getNameSpaces(intersects).forEach(function(namespace) {
            const modulesWithCurrentNamespace = intersects.filter(function(module) {
               const regexp = new RegExp(`^${namespace}|^js!${namespace}`);
               return regexp.test(module);
            });
            namespacesForConfigs[namespace] = [];
            for (let i = 0; i < modulesWithCurrentNamespace.length; i++) {
               namespacesForConfigs[namespace].push(bundlesOptions.intersects[modulesWithCurrentNamespace[i]]);
            }
            let
               moduleRoot = namespacesForConfigs[namespace][0].fullPath.replace(applicationRoot, '').split('/');
            moduleRoot = moduleRoot.length > 2 ? path.join(moduleRoot[0], moduleRoot[1]) : moduleRoot[0];
            configPath = path.join(moduleRoot, namespace.replace('.', '-').toLowerCase() + '-intersects').replace(dblSlashes, '/');
            configsArray.push({
               outputFile: path.join(applicationRoot, configPath + '.js'),
               orderQueue: namespacesForConfigs[namespace],
               packagePath: configPath
            });

            //также добавляем конфиг пересечений для данного неймспейса в бандлы
            bundlesOptions.bundles[configPath] = namespacesForConfigs[namespace];
         });

      };

      collectDepsAndIntersectsDone = function() {
         applicationRoot = applicationRoot.replace(dblSlashes, '/');
         deleteIntersectsFromPackages();
      };

      deleteIntersectsFromPackages = function() {
         async.eachLimit(configsArray, 10, function(config, done) {
            config.orderQueue = config.orderQueue.filter(function(node) {
               return !bundlesOptions.intersects[node.fullName];

            });

            //также убираем пересечения из конфига конкретного бандла
            if (bundlesOptions.bundles[config.packagePath]) {
               bundlesOptions.bundles[config.packagePath] = bundlesOptions.bundles[config.packagePath].filter(function(module) {
                  return !bundlesOptions.intersects[module];
               });
            }
            done();
         }, startCreateCustomPacks);
      };

      startCreateCustomPacks = function() {
         generateIntersectsConfig();
         customPackage.createGruntPackage(grunt, configsArray, root, badConfigs, bundlesOptions, taskDone);
      };

      taskDone = function(errors) {
         const packageNames = Object.keys(errors);
         if (packageNames.length > 0) {
            packageNames.forEach(function(packageName) {
               logger.error(`Ошибка в кастомном пакете ${packageName}: ${errors[packageName]}`);
            });
            logger.error('Fatal error: Некоторые кастомные пакеты не были созданы. Данные пакеты будут проигнорированы и не попадут в бандлы. Подробнее в логах билдера');
         } else {
            logger.debug('Задача создания кастомных пакетов выполнена.');
         }

         applicationRoot = applicationRoot.replace(dblSlashes, '/');
         if (wsRoot !== 'ws') {
            saveBundlesForEachModule(grunt, applicationRoot);
         }
         bundlesRoutePath = path.join(wsRoot, bundlesPath, 'bundlesRoute').replace(dblSlashes, '/');
         grunt.file.write(path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.json'), `${JSON.stringify(bundlesOptions.bundles)}`);
         logger.debug(`Записали bundles.json по пути: ${path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.js')}`);
         grunt.file.write(path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.js'), `bundles=${JSON.stringify(bundlesOptions.bundles)};`);
         logger.debug(`Записали bundles.js по пути: ${path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.js')}`);

         grunt.file.write(path.join(applicationRoot, wsRoot, bundlesPath, 'output.json'), `${JSON.stringify(bundlesOptions.outputs)}`);
         logger.debug(`Записали output.json по пути: ${path.join(applicationRoot, wsRoot, bundlesPath, 'output.json')}`);
         grunt.file.write(path.join(applicationRoot, `${bundlesRoutePath}.json`), JSON.stringify(bundlesOptions.modulesInBundles));
         logger.debug(`Записали bundlesRoute.json по пути: ${path.join(applicationRoot, `${bundlesRoutePath}.json`)}`);
         grunt.file.write(path.join(applicationRoot, `${bundlesRoutePath}.js`), `define("${bundlesRoutePath}",[],function(){return ${JSON.stringify(bundlesOptions.modulesInBundles)};});`);

         /**
            * Таска минификации выполняется до кастомной паковки, поэтому мы должны для СП также
            * сохранить .min бандл
            */
         if (bundlesOptions.splittedCore) {
            grunt.file.write(path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.min.js'), `bundles=${JSON.stringify(bundlesOptions.bundles)};`);
            logger.debug(`Записали bundles.min.js по пути: ${path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.min.js')}`);
         }
         done();
      };

      if (!modDeps.checkModuleDependenciesSanity(applicationRoot, taskDone)) {
         return;
      }

      dg = modDeps.getDependencyGraph(applicationRoot);

      let sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);

      /**
         * Не рассматриваем конфигурации, которые расположены в директории ws, если сборка
         * для Сервиса Представлений, поскольку конфигурации из ws являются дублями конфигураций
         * из WS.Core и один и тот же код парсится дважды.
         */
      if (wsRoot !== 'ws') {
         sourceFiles = sourceFiles.filter(function(pathToSource) {
            return !/^ws/.test(pathToSource);
         });
      }

      sourceFiles.forEach(function(pathToSource) {
         configsFiles.push(path.join(applicationRoot, pathToSource));
      });

      configsArray = customPackage.getConfigs(grunt, configsFiles, applicationRoot, badConfigs);

      if (badConfigs && badConfigs.length > 0) {
         let errorMessage = '[ERROR] Опция "include" отсутствует или является пустым массивом!' +
                ' Список конфигурационных файлов с данной ошибкой: ';
         errorMessage += badConfigs.map(function(item) {
            return '"' + item.path + '"';
         }).join(', ');
         logger.error(errorMessage);
      }

      bundlesOptions.splittedCore = this.data.splittedCore;
      customPackage.collectDepsAndIntersects(dg, configsArray, applicationRoot, wsRoot, bundlesOptions, collectDepsAndIntersectsDone);
   };
}

function gruntPackCSS(grunt) {
   return function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача паковки css.');

      let root = this.data.root,
         applicationRoot = path.join(root, this.data.application),
         htmlFiles = [];

      const sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);
      sourceFiles.forEach(function(pathToSource) {
         htmlFiles.push(path.join(applicationRoot, pathToSource));
      });

      packCSS(htmlFiles, root, path.join(applicationRoot, this.data.packages));

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача паковки css выполнена.');
   };
}

function gruntPackJS(grunt) {
   return function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача паковки js.');

      let root = this.data.root,
         applicationRoot = path.join(root, this.data.application),
         htmlFiles = [];

      const sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);
      sourceFiles.forEach(function(pathToSource) {
         htmlFiles.push(path.join(applicationRoot, pathToSource));
      });

      packJS(htmlFiles, root, path.join(applicationRoot, this.data.packages));

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача паковки js выполнена.');
   };
}

module.exports = function(grunt) {
   grunt.registerMultiTask('packwsmod', 'TODO', gruntPackModules(grunt));
   grunt.registerMultiTask('owndepspack', 'TODO', gruntPackOwnDependencies(grunt));
   grunt.registerMultiTask('collect-dependencies', 'TODO', gruntCollectDependencies(grunt));
   grunt.registerMultiTask('custompack', 'TODO', gruntCustomPack(grunt));
   grunt.registerMultiTask('packcss', 'TODO', gruntPackCSS(grunt));
   grunt.registerMultiTask('packjs', 'TODO', gruntPackJS(grunt));
};
