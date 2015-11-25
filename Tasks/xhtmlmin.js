module.exports = function(grunt) {
   grunt.registerMultiTask('xhtmlmin', 'minify xhtml and html', function () {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача xhtmlmin.');
      var   files = grunt.file.expand({cwd: process.cwd()}, this.data);
      files.forEach(function(file) {
         var data = grunt.file.read(file, {encoding: 'utf8'});
         var mn = /\/\*.*?\*+\/+?/g,
             ln = /\/\/.*\r\n/g;
         data = data.replace(ln, '');
         data = data.replace(/\s{2,}/g,' ');
         data = data.replace(/ </g,'<');
         data = data.replace(mn,'');
         grunt.file.write(file, data);
      });
      grunt.log.ok(grunt.template.today('hh:MM:ss')+ ': Задача xhtmlmin выполнена.');
   });
};