'use strict';

const path = require('path');
const fs = require('fs-extra');
const async = require('async');
const loaders = require('./loaders');
const loadersWithoutDefine = require('./loadersWithoutDefines');
const getMeta = require('./getDependencyMeta');
const packCSS = require('./../tasks/lib/packCSS').packCSS;
const packerDictionary = require('./../tasks/lib/packDictionary');
const logger = require('../../lib/logger').logger();
const pMap = require('p-map');
const dblSlashes = /\\/g,
   CDN = /\/?cdn\//,
   replacedRequire = fs.readFileSync(path.join(__dirname, 'replaceRequirejs.res')),
   checkModuleName = fs.readFileSync(path.join(__dirname, 'checkModuleName.res'));
const complexPlugins = /is!|browser!|browser\?|optional!/g;
const specialPlugins = /preload!/;
const langRe = /lang\/([a-z]{2}-[A-Z]{2})/;

// TODO: костыль: список статических html страниц для которых не пакуем стили контролов
const HTMLPAGESWITHNOONLINESTYLES = ['carry.html', 'presto.html', 'carry_minimal.html', 'booking.html', 'plugin.html', 'hint.html', 'CryptoAppWindow.html'];

// TODO: Костыль: Узнаем по наличию модуля (s3mod) в оффлайне мы или нет

const offlineModuleName = 'Retail_Offline';
let isOfflineClient;

function checkItIsOfflineClient(applicationRoot) {
   if (isOfflineClient !== undefined) {
      return isOfflineClient;
   }
   if (process.application) {
      return false;
   }
   const offlineClientModulePath = path.join(applicationRoot, `resources/${offlineModuleName}/`);
   try {
      return !!fs.existsSync(offlineClientModulePath);
   } catch (err) {
      return false;
   }
}


const PackStorage = function() {
   this._resolvedNodes = [];
};
PackStorage.prototype.addToResolvedNodes = function(defineName) {
   this._resolvedNodes.push(defineName);
};
PackStorage.prototype.isNodeResolved = function(defineName) {
   return this._resolvedNodes.indexOf(defineName) > -1;
};
PackStorage.prototype.isNodesResolved = function(defineNamesArray) {
   const self = this;
   return !defineNamesArray.filter(function(defineName) {
      return !self.isNodeResolved(defineName);
   }).length;

};
PackStorage.prototype.generateArgumentsString = function(defineNamesArray) {
   const args = [];
   for (let i = 0; i < defineNamesArray.length; i++) {
      const dep = defineNamesArray[i];
      var depWithoutComplexPlugins;

      if (dep.indexOf('css!') > -1) {
         args.push('"' + dep + '"');
      } else if (dep.indexOf('i18n!') > -1) {
         args.push('rk');
      } else if (this.isNodeResolved(dep)) {
         args.push('defineStorage["' + dep + '"]');
      } else {
         depWithoutComplexPlugins = dep.replace(complexPlugins, '');
         if (this.isNodeResolved(depWithoutComplexPlugins)) {
            args.push('defineStorage["' + depWithoutComplexPlugins + '"]');
         } else if (specialPlugins.test(depWithoutComplexPlugins)) {
            args.push('defineStorage["preloadFunc"]("' + depWithoutComplexPlugins + '")');
         } else {
            return new Error('Can\'t resolve deps');
         }
      }
   }
   return args.join();
};

/**
 * Get loader
 * @param {String} type - loader type
 * @param {Boolean} [withoutDefine]
 * @return {*|baseTextLoader}
 */
function getLoader(type, withoutDefine) {
   return withoutDefine ? loadersWithoutDefine[type] || loadersWithoutDefine.default : loaders[type] || loaders.default;
}

function promisedCopyFile(source, target) {
   return new Promise((resolve, reject) => {
      copyFile(source, target, (err, result) => {
         if (err) {
            return reject(err);
         }
         return resolve(result);
      });
   });
}

/**
 * Правильное копирование файлов
 * @param {String} source - откуда
 * @param {String} target - куда
 * @param {Function} cb - callback
 */
function copyFile(source, target, cb) {
   let cbCalled = false;

   const rd = fs.createReadStream(source);
   rd.on('error', function(err) {
      done(err);
   });
   const wr = fs.createWriteStream(target);
   wr.on('error', function(err) {
      done(err);
   });
   wr.on('close', function() {
      done();
   });
   rd.pipe(wr);

   function done(err) {
      if (!cbCalled) {
         cb(err);
         cbCalled = true;
      }
   }
}

/**
 * Формирует фейковые обертки для css, чтобы не грузить дважды
 * @param {Array} filesToPack
 * @param {Array} staticHtmlName
 * @return {String}
 */
function generateFakeModules(filesToPack, themeName, staticHtmlName) {
   return '(function(){\n' + filesToPack.filter(function removeControls(module) {
      if (themeName || !process.application && staticHtmlName && HTMLPAGESWITHNOONLINESTYLES.indexOf(staticHtmlName) > -1) {
         return !~module.fullName.indexOf('SBIS3.CONTROLS');
      } else {
         return true;
      }
   }).map(function(module) {
      return 'define(\'' + module.fullName + '\', \'\');';
   }).join('\n') + '\n})();';
}

/**
 * Подготавливает метаданные модулей графа
 * @param {DepGraph} dg
 * @param {Array} orderQueue - развернутый граф
 * @param {String} applicationRoot - полный путь до корня сервиса
 * @return {Array}
 */
function prepareOrderQueue(dg, orderQueue, applicationRoot) {
   const cssFromCDN = /css!\/cdn\//;
   return orderQueue.filter(function(dep) {
      /**
       * Проверяем чтобы упоминания cdn не было не только в пути, но и в названии
       * самого модуля, поскольку пути может и не быть по причине отсутствия в
       * module-dependencies
       */
      return dep.path ? !CDN.test(dep.path.replace(dblSlashes, '/'))
         : dep.module ? !cssFromCDN.test(dep.module) : true;
   })
      .map(function parseModule(dep) {
         const meta = getMeta(dep.module);
         if (meta.plugin === 'is') {
            if (meta.moduleYes) {
               meta.moduleYes.fullPath = dg.getNodeMeta(meta.moduleYes.fullName).path || '';
               meta.moduleYes.amd = dg.getNodeMeta(meta.moduleYes.fullName).amd;
            }
            if (meta.moduleNo) {
               meta.moduleNo.fullPath = dg.getNodeMeta(meta.moduleNo.fullName).path || '';
               meta.moduleNo.amd = dg.getNodeMeta(meta.moduleNo.fullName).amd;
            }
         } else if ((meta.plugin === 'browser' || meta.plugin === 'optional') && meta.moduleIn) {
            meta.moduleIn.fullPath = dg.getNodeMeta(meta.moduleIn.fullName).path || '';
            meta.moduleIn.amd = dg.getNodeMeta(meta.moduleIn.fullName).amd;
         } else if (meta.plugin === 'i18n') {
            meta.fullPath = dg.getNodeMeta(meta.fullName).path || dep.path || '';
            meta.amd = dg.getNodeMeta(meta.fullName).amd;
            meta.deps = dg.getDependenciesFor(meta.fullName);
         } else {
            meta.fullPath = dg.getNodeMeta(meta.fullName).path || dep.path || '';
            meta.amd = dg.getNodeMeta(meta.fullName).amd;
         }
         return meta;
      })
      .filter(function(module) {
         if (module.plugin === 'is') {
            if (module.moduleYes && !module.moduleYes.fullPath) {
               logger.warning('Empty file name: ' + module.moduleYes.fullName);
               return false;
            }
            if (module.moduleNo && !module.moduleNo.fullPath) {
               logger.warning('Empty file name: ' + module.moduleNo.fullName);
               return false;
            }
         } else if (module.plugin === 'browser' || module.plugin === 'optional') {
            if (module.moduleIn && !module.moduleIn.fullPath) {
               logger.warning('Empty file name: ' + module.moduleIn.fullName);
               return false;
            }
         } else if (!module.fullPath) {
            logger.warning('Empty file name: ' + module.fullName);
            return false;
         }
         return true;
      })
      .map(function addApplicationRoot(module) {
         if (module.plugin === 'is') {
            if (module.moduleYes) {
               module.moduleYes.fullPath = path.join(applicationRoot, module.moduleYes.fullPath).replace(dblSlashes, '/');
            }
            if (module.moduleNo) {
               module.moduleNo.fullPath = path.join(applicationRoot, module.moduleNo.fullPath).replace(dblSlashes, '/');
            }
         } else if ((module.plugin === 'browser' || module.plugin === 'optional') && module.moduleIn) {
            module.moduleIn.fullPath = path.join(applicationRoot, module.moduleIn.fullPath).replace(dblSlashes, '/');
         } else {
            module.fullPath = path.join(applicationRoot, module.fullPath).replace(dblSlashes, '/');
         }
         return module;
      })
      .map(function excludePackOwnsDependencies(module) {
         function originalPath(path) {
            return path.replace(/(\.js)$/, '.original$1');
         }

         if (module.plugin === 'is') {
            if (module.moduleYes && module.moduleYes.plugin === 'js' && fs.existsSync(originalPath(module.moduleYes.fullPath))) {
               module.moduleYes.fullPath = originalPath(module.moduleYes.fullPath);
            }
            if (module.moduleNo && module.moduleNo.plugin === 'js' && fs.existsSync(originalPath(module.moduleNo.fullPath))) {
               module.moduleNo.fullPath = originalPath(module.moduleNo.fullPath);
            }
         } else if (module.plugin === 'browser' || module.plugin === 'optional') {
            if (module.moduleIn && module.moduleIn.plugin === 'js' && fs.existsSync(originalPath(module.moduleIn.fullPath))) {
               module.moduleIn.fullPath = originalPath(module.moduleIn.fullPath);
            }
         } else if (module.plugin === 'js' && fs.existsSync(originalPath(module.fullPath))) {
            module.fullPath = originalPath(module.fullPath);
         }
         return module;
      });
}

/**
 * Разбивает массив зависмостей на объект с js, css, dict и cssForLocale
 * @param {Array} orderQueue - развернутый граф
 * @return {{js: Array, css: Array, dict: Object, cssForLocale: Object}}
 */
function prepareResultQueue(orderQueue, applicationRoot) {
   const pack = orderQueue.reduce(function(memo, module) {
      if (module.plugin === 'is') {
         if (!memo.paths[module.moduleYes.fullPath]) {
            if (module.moduleYes && module.moduleYes.plugin === 'css') {
               memo.css.push(module.moduleYes);
            } else {
               memo.js.push(module);
            }
            if (module.moduleYes) {
               memo.paths[module.moduleYes.fullPath] = true;
            }
            if (module.moduleNo) {
               memo.paths[module.moduleNo.fullPath] = true;
            }
         }
      } else if (module.plugin === 'browser' || module.plugin === 'optional') {
         if (!memo.paths[module.moduleIn.fullPath]) {
            if (module.moduleIn && module.moduleIn.plugin === 'css') {
               memo.css.push(module.moduleIn);
            } else {
               memo.js.push(module);
            }
            if (module.moduleIn) {
               memo.paths[module.moduleIn.fullPath] = true;
            }
         }
      } else {
         if (!memo.paths[module.fullPath]) {
            if (module.plugin === 'css') {
               memo.css.push(module);
            } else {
               const matchLangArray = module.fullName.match(langRe);

               /*if (matchLangArray !== null && (module.plugin === 'text' || module.plugin === 'js')) {
                        var locale = matchLangArray[1];
                        (memo.dict[locale] ? memo.dict[locale]: memo.dict[locale] = []).push(module);
                        //в итоге получится memo.dict = {'en-US': [modules], 'ru-RU': [modules], ...}
                    }
                    else */
               if (matchLangArray !== null && module.plugin === 'native-css') {
                  const locale = matchLangArray[1];
                  (memo.cssForLocale[locale] ? memo.cssForLocale[locale] : memo.cssForLocale[locale] = []).push(module);

                  //в итоге получится memo.cssForLocale = {'en-US': [modules], 'ru-RU': [modules], ...} только теперь для css-ок
               } else {
                  memo.js.push(module);
               }
            }
            memo.paths[module.fullPath] = true;
         }
      }
      return memo;
   }, {css: [], js: [], dict: {}, cssForLocale: {}, paths: {}});

   //Удалим все модули локализации добавленные жёсткими зависимостями от i18n.
   pack.js = packerDictionary.deleteModulesLocalization(pack.js);

   //Запакуем словари.
   pack.dict = packerDictionary.packerDictionary(pack.js, applicationRoot);

   return pack;
}

/**
 * @callback nativePackFiles~callback
 * @param {Error} error
 * @param {String} [result]
 */
/**
 * Просто собирает указанные файлы в один большой кусок текста
 * @param {Array} filesToPack - модули для паковки
 * @param {String} base - полный путь до папки с пакетами
 * Относительно этой папки будут высчитаны новые пути в ссылках
 * @param {nativePackFiles~callback} done
 */
function nativePackFiles(filesToPack, base, done, themeName) {
   if (filesToPack && filesToPack.length) {
      async.mapLimit(filesToPack, 5, function(module, done) {
         getLoader(module.plugin)(module, base, done, themeName);
      }, function(err, result) {
         if (err) {
            done(err);
         } else {
            done(null, result.reduce(function concat(res, modContent) {
               return res + (res ? '\n' : '') + modContent;
            }, ''));
         }
      });
   } else {
      done(null, '');
   }
}

/**
 * Тот же загрузчик модулей, что использует callback,
 * но зато могёт с промисами
 * @param loader
 * @param module
 * @param base
 * @returns {Promise<any>}
 */
function promisifyLoader(loader, module, base) {
   return new Promise((resolve, reject) => {
      loader(module, base, (err, result) => {
         if (err) {
            return reject(err);
         }
         return resolve(result);
      });
   });
}

/**
 * @callback limitingNativePackFiles~callback
 * @param {Error} error
 * @param {String} [result]
 */
/**
 * Просто собирает указанные файлы в один большой кусок текста
 * @param {Array} filesToPack - модули для паковки
 * @param {Number} limit - лимит операций
 * @param {String} base - полный путь до папки с пакетами
 * Относительно этой папки будут высчитаны новые пути в ссылках
 * @param {nativePackFiles~callback} done
 */
async function limitingNativePackFiles(filesToPack, base) {
   if (filesToPack && filesToPack.length) {
      const
         extReg = new RegExp(`\\.${module.plugin}(\\.min)?\\.js$`),
         result = [];

      await pMap(
         filesToPack,
         async module => {
            const fullPath = module.fullPath ? module.fullPath
               : module.moduleYes ? module.moduleYes.fullPath : null;

            /**
             * Позорный костыль для модулей, в которых нету плагина js, но которые используют
             * точки в конце имени модуля(например это .compatible)
             */
            if (fullPath && fullPath.match(extReg)) {
               module.plugin = 'js';
            }
            try {
               result.push(await promisifyLoader(getLoader(module.plugin), module, base));
            } catch (err) {
               logger.warning({
                  message: 'Ошибка при чтении файла во время кастомной паковки',
                  filePath: fullPath
               });
            }
         },
         {
            concurrency: 10
         }
      );
      return result;
   } else {
      return '';
   }
}

/**
 * Просто собирает указанные файлы в один большой кусок текста
 * @param {Array} filesToPack - модули для паковки
 * @param {String} base - полный путь до папки с пакетами
 * Относительно этой папки будут высчитаны новые пути в ссылках
 * @param {nativePackFiles~callback} done
 */
function nativePackFilesWithoutDefine(filesToPack, base, done) {
   if (filesToPack && filesToPack.length) {
      const packStorage = new PackStorage();
      async.series(filesToPack.map(function(module) {
         return function(done) {
            getLoader(module.plugin, true)(module, base, packStorage, done);
         };
      }), function(err, result) {
         if (err) {
            done(err);
         } else {
            let reduced;

            reduced = result.reduce(function concat(res, modContent) {
               return res + (res ? '\n' : '') + modContent;
            }, '');

            done(null, replacedRequire + reduced + checkModuleName);
         }
      });
   } else {
      done(null, '');
   }
}

/**
 * @callback getJsAndCssPackage~callback
 * @param {Error} error
 * @param {{js: string, css: string, dict: Object}} [result]
 */
/**
 * Формирует пакеты js, css и объект dict с пакетом для каждой локали
 * @param {Object} orderQueue - развернутый граф, разбитый на js, css, dict (словари локализации) и cssForLocale (css-ок для каждой локали)
 * @param {Array} orderQueue.js
 * @param {Array} orderQueue.css
 * @param {Array} orderQueue.dict
 * @param {Array} orderQueue.cssForLocale
 * @param {String} applicationRoot - полный путь до корня пакета
 * @param {Boolean} withoutDefine - паковать без define
 * @param {getJsAndCssPackage~callback} done - callback
 * @param {getJsAndCssPackage~callback} staticHtmlName - имя статической html странички
 */
function getJsAndCssPackage(orderQueue, applicationRoot, withoutDefine, bundlesOptions, done, themeName, staticHtmlName) {
   const packer = withoutDefine ? nativePackFilesWithoutDefine : nativePackFiles;
   isOfflineClient = checkItIsOfflineClient(applicationRoot);

   async.parallel({
      js: packer.bind(null, orderQueue.js.filter(function(node) {
         /** TODO
          * выпилить костыль после того, как научимся паковать пакеты для статических пакетов
          * после кастомной паковки. Модули WS.Data в связи с новой системой паковки в пакеты
          * не включаем по умолчанию. После доработки статической паковки будем учитывать
          * модули в бандлах по аналогии с rtpackage
          */
         const wsDatareg = /WS\.Data/;
         if (node.fullName && node.fullName.match(wsDatareg) || node.moduleYes && node.moduleYes.fullName.match(wsDatareg)) {
            return false;
         }

         /**
          * если по пути оригинального модуля описан кастомный пакет, то грузим по тому же пути
          * модуль с расширением .original.js. Сделано для того, чтобы мы не запаковали пакет в пакет,
          * что может привести к дублированию дефайнов и увеличению размеров исходников для всех
          * статических страничек.
          */
         const fullPath = node.fullPath || node.moduleYes && node.moduleYes.fullPath;
         if (bundlesOptions.customPackagesOutputs && bundlesOptions.customPackagesOutputs[fullPath]) {
            node.fullPath = node.fullPath.replace(/.js$/, '.original.js');
         }

         return node.amd;
      }), applicationRoot),
      css: packCSS.bind(null, orderQueue.css.filter(function removeControls(module) {
         // TODO: Написать доку по тому как должны выглядеть и распространяться темы оформления. Это трэщ
         if (themeName || !process.application && staticHtmlName && HTMLPAGESWITHNOONLINESTYLES.indexOf(staticHtmlName) > -1 || isOfflineClient) {
            //TODO Косытыль чтобы в пакет не попадали css контролов. Необходимо только для PRESTO И CARRY.
            return !module.fullName.startsWith('css!SBIS3.CONTROLS/') && !module.fullName.startsWith('css!Controls/');
         } else {
            return true;
         }
      }).map(function onlyPath(module) {
         return module.fullPath;
      }), applicationRoot),
      dict: function(callback) {
         // нужно вызвать packer для каждой локали
         const dictAsyncParallelArgs = {};
         Object.keys(orderQueue.dict).map(function(locale) {
            dictAsyncParallelArgs[locale] = packer.bind(null, orderQueue.dict[locale], applicationRoot);
         });
         async.parallel(dictAsyncParallelArgs, function(err, result) {
            if (err) {
               done(err);
            } else {
               callback(null, result);
            }
         });
      },
      cssForLocale: function(callback) {
         // нужно вызвать packer для каждой локали
         const dictAsyncParallelArgs = {};
         Object.keys(orderQueue.cssForLocale).map(function(locale) {
            dictAsyncParallelArgs[locale] = packCSS.bind(null, orderQueue.cssForLocale[locale].map(function onlyPath(module) {
               return module.fullPath;
            }), applicationRoot);
         });
         async.parallel(dictAsyncParallelArgs, function(err, result) {
            if (err) {
               done(err);
            } else {
               callback(null, result);
            }
         });
      }
   }, function(err, result) {
      if (err) {
         done(err);
      } else {
         done(null, {
            js: [generateFakeModules(orderQueue.css, themeName, staticHtmlName), result.js].filter(function(i) {
               return !!i;
            }).join('\n'),
            css: result.css.filter(function(i) {
               return !!i;
            }),
            dict: result.dict,
            cssForLocale: result.cssForLocale
         }, bundlesOptions);
      }
   });
}

module.exports = {
   prepareOrderQueue: prepareOrderQueue,
   prepareResultQueue: prepareResultQueue,
   limitingNativePackFiles: limitingNativePackFiles,
   getJsAndCssPackage: getJsAndCssPackage,
   getLoader: getLoader,
   copyFile: copyFile,
   promisedCopyFile: promisedCopyFile
};
