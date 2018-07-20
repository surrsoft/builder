/**
 * Плагин для паковки приватных частей библиотеки.
 * Приватная часть библиотеки - AMD-модуль, в начале имени
 * которого присутствует символ "_" или расположенных в
 * поддиректории папки, имя которой начинается с "_"
 * @author Колбешин Ф.А.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   libPackHelpers = require('../../../lib/pack/helpers/librarypack'),
   { packCurrentLibrary } = require('../../../lib/pack/library-packer'),
   pMap = require('p-map'),
   esExt = /\.(es|ts)$/;

/**
 * Возвращает путь до исходного ES файла для анализируемой зависимости.
 * @param sourceRoot - корень UI-исходников
 * @param privateModulesCache - кэш из changesStore для приватных модулей
 * @param moduleName - имя анализируемой зависимости
 * @returns {String}
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
      result = `${path.join(sourceRoot, moduleName)}.js`
   }
   return result;
}

/**
 * Объявление плагина
 * @param {ChangesStore} changesStore кеш
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {Pool} pool пул воркеров
 * @returns {*}
 */
module.exports = function declarePlugin(config, changesStore, moduleInfo) {
   const
      libraries = [],
      root = config.rawConfig.output;

   return through.obj(

      /* @this Stream */
      function onTransform(file, encoding, callback) {
         if (
            file.extname === '.js' &&
            esExt.test(file.history[0]) &&
            !libPackHelpers.isPrivate(path.relative(moduleInfo.output, file.path))
         ) {
            libraries.push(file);
            callback();
         } else {
            callback(null, file);
         }
      },

      /* @this Stream */
      async function onFlush(callback) {
         const
            privatePartsCache = changesStore.getCompiledEsModuleCache(moduleInfo.name),
            sourceRoot = moduleInfo.path.replace(moduleInfo.name, '');
         await pMap(
            libraries,
            async(library) => {
               const privatePartsForChangesStore = [];
               let result;
               try {
                  result = await packCurrentLibrary(
                     sourceRoot,
                     privatePartsForChangesStore,
                     library.contents.toString(),
                     privatePartsCache
                  );
               } catch (error) {
                  logger.error({
                     error
                  });
               }
               if (privatePartsForChangesStore.length > 0) {
                  changesStore.addDependencies(library.history[0], privatePartsForChangesStore.map(
                     dependency => getSourcePathByModuleName(sourceRoot, privatePartsCache, dependency)
                  ));
               }
               library.modulepack = result;
               this.push(library);
            },
            {
               concurrency: 10
            }
         );
         callback(null);
      }
   );
};
