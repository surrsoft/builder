'use strict';

var path = require('path');

module.exports = function (grunt) {
   var buildnumber = grunt.option('versionize');
   var root = grunt.option('root') || '';
   var app = grunt.option('application') || '';
   var resourcesPath = path.join(root, app, 'resources');
   var contents = {};

   grunt.registerMultiTask('ver-contents', 'versionize contents.[js|json]', function () {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача ver-contents.');

      try {
         contents = require(path.join(resourcesPath, 'contents.json'));
      } catch (err) {
         grunt.log.warn('contents.json doesn\'t exist');
      }

      try {
         contents.buildnumber = buildnumber;
         grunt.file.write(path.join(resourcesPath, 'contents.json'), JSON.stringify(contents, null, 2));
         grunt.file.write(path.join(resourcesPath, 'contents.js'), 'contents='+JSON.stringify(contents));
      } catch (err) {
         grunt.fail.fatal(err);
      }
   });
};