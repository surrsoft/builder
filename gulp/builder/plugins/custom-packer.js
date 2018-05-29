'use strict';

const through = require('through2'),
   path = require('path'),
   domHelpers = require('../../../packer/lib/domHelpers'),
   logger = require('../../../lib/logger').logger();

module.exports = function generatePackageJson() {
   return through.obj(function onTransform(file, encoding, callback) {
      console.log(file.path);
      var test = JSON.parse(file._contents);
      //new fileNew = Vanyl(...);
      this.push(fileNew);
      callback(null, fileNew);
   });
};
