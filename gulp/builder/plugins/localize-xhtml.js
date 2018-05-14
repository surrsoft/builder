'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger();


module.exports = function(config, changesStore, moduleInfo, pool) {
   return through.obj(async function(file, encoding, callback) {
      try {
         if (file.cached) {
            callback(null, file);
            return;
         }
         if (file.extname !== '.xhtml') {
            callback(null, file);
            return;
         }
         const componentsPropertiesFilePath = path.join(config.cachePath, 'components-properties.json');
         const newText = await pool.exec('prepareXHTML', [file.contents.toString(), componentsPropertiesFilePath]);
         file.contents = Buffer.from(newText);
      } catch (error) {
         changesStore.markFileAsFailed(file.history[0]);
         logger.error({
            message: 'Ошибка при локализации XHTML',
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
