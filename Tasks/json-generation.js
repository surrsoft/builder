var sbis3JSONGenerator = require('sbis3-json-generator'),
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

      var generatorOptions = {
         outDir: options.outDir && relative(options.outDir),
         isWs: options.isWs,
         showStdout: false
      };


      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации начато.');

      sbis3JSONGenerator.generateJson(relative(options.inDir), done, generatorOptions);

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации выполнено.');
   });

};
