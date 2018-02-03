'use strict';

const through = require('through2'),
   parseJsComponent = require('../../lib/parse-js-component');

module.exports = function() {
   return through.obj(function(file, encoding, callback) {
      if(file.extname === '.js'){
         file.componentInfo = parseJsComponent(file.contents.toString());
      }
      this.push(file);
      callback();
   });
};
