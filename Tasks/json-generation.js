var
  sbis3_json_generator = require('../node_modules/sbis3-json-generator'),
  path = require('path');

module.exports = function(grunt) {

  grunt.registerTask('generateJson', 'Generate json', function() {

    var done = this.async();

    var options = this.options({
         'inDir': grunt.option('root'),
         'outDir': '',
         'isWs': false
      });

    var relative = path.relative.bind(path, [process.cwd()]);

    var generator_options = {
      outDir: options.outDir && relative(options.outDir),
      isWs: options.isWs,
      showStdout: false
    };


    sbis3_json_generator.generateJson(relative(options.inDir), done, generator_options);
  });

};
