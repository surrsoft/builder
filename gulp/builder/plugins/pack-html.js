'use strict';

const through = require('through2'),
   path = require('path'),
   domHelpers = require('../../../packer/lib/domHelpers'),
   logger = require('../../../lib/logger').logger();

module.exports = function(moduleInfo, pool) {
   return through.obj(async(file, encoding, callback) => {
      try {
         if (file.extname !== '.html' || path.dirname(file.path) !== moduleInfo.output) {
            callback(null, file);
            return;
         }

         let newText = file.contents.toString();
         newText = await pool.exec('minifyXhtmlAndHtml', [newText]);
         const dom = domHelpers.domify(newText);

         file.contents = Buffer.from(domHelpers.stringify(dom));
      } catch (error) {
         logger.error({
            message: "Ошибка builder'а при паковке html",
            error,
            moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
