/* eslint-disable no-invalid-this */
'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger();


module.exports = function(config, moduleInfo, pool) {
   return through.obj(async function(file, encoding, callback) {
      try {
         if (file.extname !== '.xhtml') {
            callback(null, file);
            return;
         }
         const componentsPropertiesFilePath = path.join(config.cachePath, 'components-properties.json');
         const newText = await pool.exec('prepareXHTML', [file.contents.toString(), componentsPropertiesFilePath]);
         file.contents = Buffer.from(newText);
      } catch (error) {
         logger.error({
            message: 'Ошибка Builder\'а',
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.path
         });
      }
      this.push(file);
      callback();
   });
};
