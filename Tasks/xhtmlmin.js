var fs = require('fs');
var path = require('path');
module.exports = function(grunt) {
   grunt.registerMultiTask('xhtmlmin', 'minify xhtml', function () {
      var done = this.async();
      var availableFiles;
      this.files.forEach(function(file) {
         availableFiles = getAvailableFiles(file.src);
      }, this);
      for(var i=0; i < availableFiles.length; i++) {
         readFileData(availableFiles[i]);
      }
   });

   var getAvailableFiles = function(filesArray) {
      return filesArray.filter(function (filepath) {
      if(!grunt.file.exists(filepath)) {
         return false;
      }
      return true;
      });
   };

   var readFileData = function(file) {
      fs.readFile(file, {encoding: 'utf8'}, function (err, data) {
      if (err) throw err;
      minifyDoc(data, file);
      });
   };

   var minifyDoc = function(fileData, originalFile) {
      var fileDir = path.dirname(originalFile),
          fileName = path.basename(originalFile);
      fileData = fileData.replace(/\s{2,}/g,' ');
      fileData = fileData.replace(/ </g,'<');
      fs.writeFile(fileDir + '/' + fileName, fileData, function(err) {
         if(err) {
            console.log(err);
         }
      });
   };
};