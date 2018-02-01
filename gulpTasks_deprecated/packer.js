'use strict';

const async = require('async');
const fs = require('fs');
const loadersWithoutDefine = require('grunt-wsmod-packer/lib/loadersWithoutDefines.js');

/**
 * Get loader
 * @param {String} type - loader type
 * @param {Boolean} [withoutDefine]
 * @return {*|baseTextLoader}
 */
function getLoader(type, withoutDefine) {
   return withoutDefine ? loadersWithoutDefine[type] || loadersWithoutDefine.default : loaders[type] || loaders.default;
}

// TODO: Костыль: Узнаем по наличию модуля (s3mod) в оффлайне мы или нет

var offlineModuleName = 'Retail_Offline';
var isOfflineClient;

function checkItIsOfflineClient(applicationRoot) {
   var self = this;
   if (isOfflineClient !== undefined) {
      return isOfflineClient;
   }
   if (process.application) {
      return false;
   }
   var offlineClientModulePath = path.join(applicationRoot, `resources/${offlineModuleName}/`);
   try {
      return !!fs.existsSync(offlineClientModulePath);
   } catch (err) {
      return false;
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
      var packStorage = new PackStorage();
      async.series(filesToPack.map(function(module) {
         return function(done) {
            getLoader(module.plugin, true)(module, base, packStorage, done);
         };
      }), function(err, result) {
         if (err) {
            done(err);
         } else {
            var reduced;

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
function getJsAndCssPackage(orderQueue, applicationRoot, withoutDefine, done, themeName, staticHtmlName, themeNameFromDOM) {
   var packer = withoutDefine ? nativePackFilesWithoutDefine : nativePackFiles;
   var themeName = themeName;
   var staticHtmlName = staticHtmlName;
   isOfflineClient = checkItIsOfflineClient(applicationRoot);

   async.parallel({
      js: packer.bind(null, orderQueue.js, applicationRoot),
      css: packCSS.bind(null, orderQueue.css.filter(function removeControls(module) {
         // TODO: Написать доку по тому как должны выглядеть и распространяться темы оформления. Это трэщ
         if ((themeName || !process.application && staticHtmlName && HTMLPAGESWITHNOONLINESTYLES.indexOf(staticHtmlName) > -1) || isOfflineClient || themeNameFromDOM) {
            return !~module.fullName.indexOf('SBIS3.CONTROLS');
         } else {
            return true;
         }
      }).map(function onlyPath(module) {
         return module.fullPath;
      }), applicationRoot),
      dict: function(callback) {
         // нужно вызвать packer для каждой локали
         var dictAsyncParallelArgs = {};
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
         var dictAsyncParallelArgs = {};
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
         });
      }
   });
}

module.exports = getJsAndCssPackage;
