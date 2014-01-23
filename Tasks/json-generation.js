var
  sbis3_json_generator = require('../node_modules/sbis3-json-generator'),
  path = require('path');

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
  });

  grunt.registerTask('generateJson', 'Generate json', function() {

    var done = this.async();

    var options = this.options({
         'in_dir': grunt.option('root'),
         'out_dir': '',
         'is_ws': false
      });

    var relative = path.relative.bind(path, [process.cwd()]);

    var generator_options = {
      out_dir: options.out_dir && relative(options.out_dir),
      is_ws: options.is_ws,
      show_stdout: false
    };


    sbis3_json_generator.generateJson(relative(options.in_dir), done, generator_options);
  });

};