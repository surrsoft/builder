/**
 * Плагин для создания versioned_modules.json (список проверсионированных файлах)
 * @author Колбешин Ф.А.
 */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   path = require('path'),
   helpers = require('../../../lib/helpers'),
   transliterate = require('../../../lib/transliterate');

/**
 * Объявление плагина
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {stream}
 */
module.exports = function declarePlugin(taskParameters, moduleInfo) {
   taskParameters.versionedModules = {};
   return through.obj(
      function onTransform(file, encoding, callback) {
         /**
          * для оставшихся модулей(минифицированные css, статические html) также
          * не забываем записать в кэш информацию
          */
         if (file.versioned && (file.basename.endsWith('.html') || file.basename.endsWith(`.min${file.extname}`))) {
            taskParameters.cache.storeVersionedModule(file.history[0], moduleInfo.name, transliterate(file.history[0]));
         }
         callback(null, file);
      },

      /* @this Stream */
      function onFlush(callback) {
         try {
            const versionedModules = [];
            const versionCache = taskParameters.cache.getVersionedModulesCache(moduleInfo.name);
            const prettyCacheModulePath = helpers.prettifyPath(moduleInfo.output);
            const prettyModulePath = helpers.prettifyPath(transliterate(moduleInfo.path));
            Object.keys(versionCache).forEach((currentModule) => {
               versionedModules.push(...versionCache[currentModule]);
            });
            const versionedModulesPaths = versionedModules.map((currentFile) => {
               const
                  prettyFilePath = helpers.prettifyPath(currentFile),
                  isSourcePath = prettyFilePath.includes(prettyModulePath),
                  relativePath = path.relative(isSourcePath ? prettyModulePath : prettyCacheModulePath, prettyFilePath);
               return helpers.unixifyPath(path.join(transliterate(moduleInfo.name), relativePath));
            });

            const file = new Vinyl({
               path: '.builder/versioned_modules.json',
               contents: Buffer.from(JSON.stringify(versionedModulesPaths, null, 2)),
               moduleInfo
            });
            this.push(file);

            /**
             * оставляем версионированные модули, могут пригодиться в дальнейшем при паковке
             * @type {string[]}
             */
            taskParameters.versionedModules[transliterate(moduleInfo.name)] = versionedModulesPaths;
         } catch (error) {
            logger.error({
               message: "Ошибка Builder'а",
               error,
               moduleInfo
            });
         }
         callback();
      }
   );
};
