'use strict';

const path = require('path');
const async = require('async');
const dblSlashes = /\\/g;
const packerDictionary = require('./packDictionary');
const commonPackage = require('./../../lib/commonPackage');
const excludeCore = ['^Core/*', '^Deprecated/*', '^Transport/*'];
const logger = require('../../../lib/logger').logger();

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
function getOutputFile(cfg, applicationRoot, dg, bundlesOptions) {
   let
      mDepsPath = dg.getNodeMeta(cfg.output).path,
      outputFile;

   if (mDepsPath) {
      outputFile = mDepsPath;
   } else {
      outputFile = path.join(path.dirname(cfg.path), path.normalize(cfg.output));
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

   return new RegExp(regexpStr);
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
   //если особый пакет(вебинары), то оставляем старый способ паковки
   if (!cfg.includeCore && cfg.modules) {
      cfg.modules.forEach(function(expression) {
         if (!cfg.include.includes(expression)) {
            cfg.include.push(expression);
         }
      });
      var excludeCoreReg = generateRegExp(excludeCore);
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
 * Генерирует кастомный пакет для requirejs конфигурации.
 * @param {Object} orderQueue - очередь модулей на запись в пакет.
 * @return {Array}
 */
function generateBundle(orderQueue) {
   const
      bundle = [];

   orderQueue.forEach(function(node) {
      if (node.amd || node.plugin === 'css') {
         bundle.push(node.fullName);
      }
   });

   return bundle;
}

/**
 * Генерирует список: модуль и путь до пакета, в котором он лежит
 * @param currentBundle - текущий бандл
 * @param pathToBundle - физический путь до бандла
 * @param bundlesRoutingObject - результирующий список
 */
function generateBundlesRouting(currentBundle, pathToBundle, bundlesRoutingObject) {
   for (let i = 0; i < currentBundle.length; i++) {
      if (currentBundle[i].indexOf('css!') === -1) {
         bundlesRoutingObject[currentBundle[i]] = pathToBundle;
      }
   }
}

/**
 * Создает кастомный пакет по заданной конфигурации.
 * @param {Object} grunt
 * @param {DepGraph} dg - граф завивимостей
 * @param {Object} cfg - конфигурация
 * @param {Array} cfg.modules - массив вершин графа
 * @param {Array} [cfg.include] - массив модулей, который нужно оставить
 * @param {Array} [cfg.exclude] - массив модулей, которые надо исключить
 * @param {String} cfg.output - имя выходного файла, может быть именем модуля
 * @param {String} root - корень статики
 * @param {String} applicationRoot - полный путь до корня сервиса
 * @param {Object} bundlesOptions - Объект с пакетами для requirejs конфигурации. Включает 2 опции: bundles - конфигурация для requirejs, modulesInBundles - модули и пути до пакетов с данными модулями.
 * @param {Function} done - коллбек типа done
 */
function _createGruntPackage(grunt, cfg, root, bundlesOptions, done) {
   function callBack(err) {
      if (err) {
         done(err);
      } else {
         commonPackage.limitingNativePackFiles(cfg.orderQueue, 10, root, function(err, result) {
            if (err) {
               //удаляем из бандлов конфигурацию, если пакет по итогу не смог собраться
               delete bundlesOptions.bundles[cfg.packagePath];
               done(err);
            } else {
               grunt.file.write(cfg.outputFile, result ? result.reduce(function concat(res, modContent) {
                  return res + (res ? '\n' : '') + modContent;
               }, '') : '');

               /**
                * временно генерим css-ную пустышку для ситуации, когда динамически
                * просят css-ку, имя которой совпадает с компонентом и который присутствует
                * в каком либо бандле.
                * TODO Написать генерацию кастомного css-пакета наподобие rt-паковки
                */
               const pathToCustomCSS = cfg.outputFile.replace(/\.js$/, '.css');
               if (!grunt.file.exists(pathToCustomCSS)) {
                  grunt.file.write(pathToCustomCSS, '');
               }
               done(null);
            }
         });
      }
   }

   // Не будем портить оригинальный файл.
   if (grunt.file.exists(cfg.outputFile) && !grunt.file.exists(originalPath(cfg.outputFile))) {
      commonPackage.copyFile(cfg.outputFile, originalPath(cfg.outputFile), callBack);
   } else {
      callBack();
   }
}

//собираем зависимости для конкретной конфигурации кастомной паковки
function _collectDepsAndIntersects(dg, cfg, applicationRoot, wsRoot, bundlesOptions, done) {
   let
      orderQueue,

      outputFile,
      packagePath;

   orderQueue = getOrderQueue(dg, cfg, applicationRoot);
   outputFile = getOutputFile(cfg, applicationRoot, dg, bundlesOptions);
   packagePath = getBundlePath(outputFile, applicationRoot, wsRoot);

   orderQueue = orderQueue.filter(function(node) {
      if (node.plugin === 'js') {
         return node.amd;
      }
      return true;
   });

   if (cfg.platformPackage || !cfg.includeCore) {
      bundlesOptions.bundles[packagePath] = generateBundle(orderQueue);
      generateBundlesRouting(bundlesOptions.bundles[packagePath], packagePath, bundlesOptions.modulesInBundles);
   }

   orderQueue = packerDictionary.deleteModulesLocalization(orderQueue);
   orderQueue = packerDictionary.packerCustomDictionary(orderQueue, applicationRoot);

   cfg.outputFile = outputFile;
   cfg.packagePath = packagePath;
   cfg.orderQueue = orderQueue;
   bundlesOptions.outputs[cfg.outputFile] = 1;
   done();
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
function checkConfigForIncludeOption(config, cfgPath, applicationRoot, badConfigs, configsArray) {
   config.path = cfgPath.replace(applicationRoot, '');
   if (config.includeCore || config.include && config.include.length > 0) {
      configsArray.push(config);
   } else {
      badConfigs.push(config);
   }
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
function getConfigs(grunt, configsFiles, applicationRoot, badConfigs) {
   const configsArray = [];
   configsFiles.forEach(function(cfgPath) {
      let cfgContent = grunt.file.readJSON(cfgPath),
         packageName = path.basename(cfgPath);

      if (cfgContent instanceof Array) {
         for (let i = 0; i < cfgContent.length; i++) {
            const cfgObj = cfgContent[i];
            cfgObj.packageName = packageName;
            cfgObj.configNum = i + 1;
            checkConfigForIncludeOption(cfgObj, cfgPath, applicationRoot, badConfigs, configsArray);
         }
      } else {
         cfgContent.packageName = packageName;
         checkConfigForIncludeOption(cfgContent, cfgPath, applicationRoot, badConfigs, configsArray);
      }
   });

   return configsArray;
}

/**
 * @callback createGruntPackage~callback
 * @param {Error} [error]
 */
/**
 * Создаем пакеты по конфигурациям
 * @param {Object} grunt
 * @param {DepGraph} dg - граф зависимостей
 * @param {Array} configs - массив конфигураций
 * @param {Array} configs.modules - массив вершин графа
 * @param {Array} [configs.include] - массив модулей, который нужно оставить
 * @param {Array} [configs.exclude] - массив модулей, которые надо исключить
 * @param {String} configs.output - имя выходного файла, может быть именем модуля
 * @param {String} root - корень статики
 * @param {String} applicationRoot - полный путь до корня сервиса
 * @param {Object} bundles - пакеты для requirejs конфигурации
 * @param {createGruntPackage~callback} taskDone - callback
 */
function createGruntPackage(grunt, configs, root, badConfigs, bundlesOptions, taskDone) {
   if (badConfigs.length > 0) {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Будет проигронировано ' + badConfigs.length + ' конфигураций кастомной паковки. Смотри описание ошибки выше.');
   }
   grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Обнаружено ' + configs.length + ' конфигураций кастомной паковки');

   const errors = {};
   async.eachLimit(configs, 3, function(config, callback) {
      const configNum = config.configNum ? 'конфигурация №' + config.configNum : '';

      _createGruntPackage(grunt, config, root, bundlesOptions, function(err) {
         if (err) {
            errors[config.packageName] = err;

            /**
             * Ошибка создания пакета. Удаляем все его упоминания из бандлов.
             */
            Object.keys(bundlesOptions.modulesInBundles).forEach(function(moduleName) {
               if (bundlesOptions.modulesInBundles[moduleName] === config.packagePath) {
                  delete bundlesOptions.modulesInBundles[moduleName];
               }
            });
            logger.error({
               message: `Ошибка создания кастомного пакета по конфигурационному файлу ${config.packageName} - ${configNum}`,
               error: err
            });
         } else {
            logger.debug(`Создан кастомный пакет по конфигурационному файлу ${config.packageName} - ${configNum}`);
         }

         /**
          * даже в случае ошибки передавать в итеративный callback ошибку мы не будем,
          * поскольку согласно документации async это прерывает выполнение всех остальных
          * работающих в данный момент потоков, в результате чего мы имеем половину нерабочих
          * нерабочих пакетов при сломавшемся одном
          */
         callback();
      });
   }, function(err, result) {
      taskDone(errors, result);
   });
}

function collectDepsAndIntersects(dg, configs, applicationRoot, wsRoot, bundlesOptions, collectDepsAndIntersectsDone) {
   async.eachLimit(configs, 3, function(config, callback) {
      _collectDepsAndIntersects(dg, config, applicationRoot, wsRoot, bundlesOptions, function(err) {
         callback(err);
      });
   }, function() {
      collectDepsAndIntersectsDone(configs);
   });
}

module.exports = {
   getConfigs: getConfigs,
   createGruntPackage: createGruntPackage,
   collectDepsAndIntersects: collectDepsAndIntersects
};
