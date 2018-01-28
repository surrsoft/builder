'use strict';

const through = require('through2'),
   htmlTmpl = require('../lib/html-tmpl');

module.exports = function() {
   return through.obj(function(file, encoding, callback) {
      htmlTmpl.convertHtmlTmpl(file.contents.toString(), '', result => {
         file.contents = new Buffer(result);
         callback(null, file);
      });
   });
};
