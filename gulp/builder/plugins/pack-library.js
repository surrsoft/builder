/**
 * Плагин для паковки приватных частей библиотеки.
 * Приватная часть библиотеки - AMD-модуль, в начале имени
 * которого присутствует символ "_" или расположенных в
 * поддиректории папки, имя которой начинается с "_"
 * @author Колбешин Ф.А.
 */

/* eslint-disable no-invalid-this */
'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   libPackHelpers = require('../../../lib/pack/helpers/librarypack'),
   helpers = require('../../../lib/helpers'),
   { packCurrentLibrary } = require('../../../lib/pack/library-packer'),
   esExt = /\.(es|ts)$/;

/**
 * Объявление плагина
 * @param {ChangesStore} changesStore кеш
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {Pool} pool пул воркеров
 * @returns {*}
 */
module.exports = function declarePlugin(config, changesStore, moduleInfo) {
   const
      privateParts = {},
      libraries = [],
      root = config.rawConfig.output;

   return through.obj(

      /* @this Stream */
      function onTransform(file, encoding, callback) {
         if (file.extname === '.js' && esExt.test(file.history[0])) {
            if (!libPackHelpers.isPrivate(path.relative(moduleInfo.output, file.path))) {
               libraries.push(file);
               callback();
            } else {
               const dependency = helpers.unixifyPath(path.join(
                  moduleInfo.name,
                  path.relative(moduleInfo.output, file.path)
               ));
               privateParts[dependency] = file;
               callback(null, file);
            }
         } else {
            callback(null, file);
         }
      },
      function onFlush(callback) {
         libraries.forEach((library) => {
            const privatePartsForChangesStore = [];
            let result;
            try {
               result = packCurrentLibrary(
                  root,
                  privatePartsForChangesStore,
                  library.contents.toString(),
                  privateParts
               );
            } catch (error) {
               logger.error({
                  error
               });
            }
            if (privatePartsForChangesStore.length > 0) {
               changesStore.addDependencies(library.history[0], privatePartsForChangesStore.map(
                  dependency => privateParts[dependency].history[0]
               ));
            }
            library.modulepack = result;
            this.push(library);
         });
         callback(null);
      }
   );
};
