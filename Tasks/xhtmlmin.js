module.exports = function(grunt) {
   grunt.registerMultiTask('xhtmlmin', 'minify xhtml and html', function () {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача xhtmlmin.');
      var files = grunt.file.expand({cwd: process.cwd()}, this.data);
      files.forEach(function(file) {
         readFileData(file, function(fileData, originalFile) {
            fileData = fileData.replace(/\s{2,}/g,' ');
            fileData = fileData.replace(/ </g,'<');
            grunt.file.write(originalFile, fileData);
         });
      });
      grunt.log.ok(grunt.template.today('hh:MM:ss')+ ': Задача xhtmlmin выполнена.');
   });

   function readFileData(file, callback) {
      var data = grunt.file.read(file, {encoding: 'utf8'});
      callback(data, file);
   }
};