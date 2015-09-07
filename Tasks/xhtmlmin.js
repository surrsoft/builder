var fs = require('fs');
var path = require('path');
module.exports = function(grunt) {
   grunt.registerMultiTask('xhtmlmin', 'minify xhtml', function () {
      var done = this.async,
          files = grunt.file.expand({cwd: process.cwd()}, this.data);
      files.forEach(function(file) {
         readFileData(file, function(fileData, originalFile) {
            fileData = fileData.replace(/\s{2,}/g,' ');
            fileData = fileData.replace(/ </g,'<');
            fs.writeFile(originalFile, fileData, function(err) {
               if(err) {
                  grunt.log.error(err);
               } else {
                  grunt.log.ok(path.basename(originalFile));
               }
            });
         });
      });
      done();
   });

   function readFileData(file, callback) {
      fs.readFile(file, {encoding: 'utf8'}, function (err, data) {
      if (err) throw err;
      callback(data, file);
      });
   }
};