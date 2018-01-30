'use strict';

const through = require('through2');

module.exports = function(moduleInfo) {
   return through.obj(function(file, encoding, callback) {
      file.moduleInfo = moduleInfo;
      this.push(file);
      callback();
   });
};
