var sbis3JSONGenerator = require('sbis3-json-generator');

module.exports = function(grunt) {

   grunt.registerTask('generateJson', 'Generate json', function() {

      var done = this.async();

      var options = this.options({
         'inDir': grunt.option('root'),
         'outDir': '',
         'isWs': false
      });

      var generatorOptions = {
         outDir: options.outDir,
         isWs: options.isWs,
         showStdout: false
      };


      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации начато.');

      sbis3JSONGenerator.generateJson(options.inDir, done, generatorOptions);

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации выполнено.');
   });

};
