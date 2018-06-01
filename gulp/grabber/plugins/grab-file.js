'use strict';

const through = require('through2'),
   path = require('path'),
   promiseTimeout = require('../../../lib/promise-with-timeout'),
   logger = require('../../../lib/logger').logger();

const supportExtensions = ['.js', '.xhtml', '.tmpl'];
module.exports = function declarePlugin(config, cache, moduleInfo, pool) {
   return through.obj(async(file, encoding, callback) => {
      if (!supportExtensions.includes(file.extname)) {
         callback();
         return;
      }

      if (file.cached) {
         callback();
         return;
      }

      let collectWords = [];
      try {
         const componentsPropertiesFilePath = path.join(config.cachePath, 'components-properties.json');
         const promiseExec = pool
            .exec('collectWords', [moduleInfo.path, file.path, componentsPropertiesFilePath])
            .timeout(10000);

         // установим таймаут на минуту. на случай зависания воркера на сервере сборки
         collectWords = await promiseTimeout.promiseWithTimeout(promiseExec, 60000);
         cache.storeCollectWords(file.history[0], collectWords);
      } catch (error) {
         logger.warning({
            message: 'Ошибка при обработке файла',
            filePath: file.path,
            error,
            moduleInfo
         });
      }
      callback();
   });
};
