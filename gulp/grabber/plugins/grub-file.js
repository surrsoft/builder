'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger();

const supportExtensions = ['.js', '.xhtml', '.tmpl'];
module.exports = function(config, cache, moduleInfo, pool) {
   return through.obj(async function(file, encoding, callback) {
      if (!supportExtensions.includes(file.extname)) {
         callback();
         return;
      }
      let collectWords = [];
      try {
         const componentsPropertiesFilePath = path.join(config.cachePath, 'components-properties.json');
         collectWords = await pool.exec('collectWords', [moduleInfo.path, file.path, componentsPropertiesFilePath]);
         cache.storeCollectWords(file.history[0], collectWords);
      } catch (error) {
         logger.error({
            message: 'Ошибка при обработке файла',
            filePath: file.history[0],
            error: error,
            moduleInfo: moduleInfo
         });
      }
      callback();
   });
};
