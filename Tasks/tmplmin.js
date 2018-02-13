'use strict';

const path = require('path');

function xmlMin(text) {

   const str = text.replace(/<![ \r\n\t]*(--([^\-]|[\r\n]|-[^\-])*--[ \r\n\t]*)>/g, '');
   return  str.replace(/>\s{0}</g, '><');
}

module.exports = function(grunt) {
   grunt.registerMultiTask('tmplmin', 'Minify templates', function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача tmplmin.');
      let root = grunt.option('root') || '',
         app = grunt.option('application') || '',
         rootPath = path.join(root, app),
         sourceFiles = grunt.file.expand({cwd: rootPath}, this.data.src);

      sourceFiles.forEach(function(file) {
         const xmlPath = path.join(rootPath, file);
         const xmlContent = grunt.file.read(xmlPath);
         grunt.file.write(xmlPath, xmlMin(xmlContent));

      });

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача tmplmin выполнена.');
   });
};
