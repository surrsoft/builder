/* eslint-disable no-invalid-this */
'use strict';

const through = require('through2'),
   logger = require('../../../lib/logger').logger(),
   prepareXHTML = require('../../../lib/i18n/prepare-xhtml');


//если есть ресурсы локализации, то нужно записать <локаль>.js файл в папку "lang/<локаль>" и занести данные в contents.json
// + css локализации нужно объединить
module.exports = function(moduleInfo) {
   const componentsProperties = {};
   return through.obj(function(file, encoding, callback) {
      try {
         if (file.extname !== '.xhtml') {
            callback(null, file);
            return;
         }
         file.contents = Buffer.from(prepareXHTML(file.contents.toString(), componentsProperties));
         this.push(file);
      } catch (error) {
         logger.error({
            message: 'Ошибка Builder\'а',
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.path
         });
      }
      callback();
   });
};
