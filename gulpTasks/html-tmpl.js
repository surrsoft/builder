'use strict';

const through = require('through2'),
   htmlTmpl = require('../lib/html-tmpl'),
   logger = require('./../lib/logger').logger;

module.exports = function() {
   return through.obj(function(file, encoding, cb) {
      htmlTmpl.convertHtmlTmpl(file.contents.toString(), '', (error, result) => {
         if (error) {
            logger.exception('Ошибка при обработке шаблона', error, 1);
         }
         file.contents = new Buffer(result);
         this.push(file);
         cb();
      });
   });
};
