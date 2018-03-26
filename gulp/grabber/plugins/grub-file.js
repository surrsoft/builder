'use strict';

const through = require('through2'),
   logger = require('../../../lib/logger').logger();

const supportExtensions = ['.js'];
module.exports = function(cache, moduleInfo, pool) {
   return through.obj(async function(file, encoding, callback) {
      if (!supportExtensions.includes(file.extname)) {
         callback();
         return;
      }
      let collectWords = [];
      try {
         collectWords = await pool.exec('collectWords', [moduleInfo.path, file.path]);
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
   }, function(callback) {
      /*
      try {

      } catch (error) {
         logger.error({
            message: 'Ошибка Builder\'а',
            error: error,
            moduleInfo: moduleInfo
         });
      }*/
      callback();
   });
};
