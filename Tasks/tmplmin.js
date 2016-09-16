var path = require('path');

function xmlMin(text) {

   var str = text.replace(/\<![ \r\n\t]*(--([^\-]|[\r\n]|-[^\-])*--[ \r\n\t]*)\>/g,"");
   return  str.replace(/>\s{0,}</g,"><");
}

module.exports = function(grunt) {
   grunt.registerMultiTask('tmplmin', 'Minify templates', function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача tmplmin.');
      var root = grunt.option('root') || '',
         app = grunt.option('application') || '',
         rootPath = path.join(root, app),
         sourceFiles = grunt.file.expand({cwd: rootPath}, this.data.src);

      sourceFiles.forEach(function (file) {
         var xmlPath = path.join(rootPath, file);
         var xmlContent = grunt.file.read(xmlPath);
         grunt.file.write(xmlPath, xmlMin(xmlContent));

      });

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача tmplmin выполнена.');
   });
};
