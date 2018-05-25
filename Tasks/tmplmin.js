'use strict';

const path = require('path');
const minifyTmpl = require('../lib/processing-tmpl').minifyTmpl;

module.exports = function(grunt) {
   grunt.registerMultiTask('tmplmin', 'Minify templates', function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача tmplmin.');
      const root = grunt.option('root') || '',
         app = grunt.option('application') || '',
         rootPath = path.join(root, app),
         sourceFiles = grunt.file.expand({cwd: rootPath}, this.data.src);

      sourceFiles.forEach(function(file) {
         const xmlPath = path.join(rootPath, file);
         const xmlContent = grunt.file.read(xmlPath);
         grunt.file.write(xmlPath, minifyTmpl(xmlContent));

      });

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача tmplmin выполнена.');
   });
};
