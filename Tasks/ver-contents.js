'use strict';

const path = require('path');
const helpers = require('../lib/helpers');

module.exports = function(grunt) {
   grunt.registerMultiTask('ver-contents', 'versionize contents.[js|json]', function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача ver-contents.');

      const resourcesPath = path.join(this.data.cwd, 'resources');
      let contents = {};

      try {
         contents = grunt.file.readJSON(path.join(resourcesPath, 'contents.json'));
      } catch (err) {
         grunt.log.warn('Error while requiring contents.json', err);
      }

      try {
         contents.buildnumber = this.data.ver;
         contents = helpers.sortObject(contents);
         grunt.file.write(path.join(resourcesPath, 'contents.json'), JSON.stringify(contents, null, 2));
         grunt.file.write(path.join(resourcesPath, 'contents.js'), 'contents=' + JSON.stringify(contents));
      } catch (err) {
         grunt.fail.fatal(err);
      }
   });
};
