var path = require('path'),
    fs = require('fs'),
    child_process = require('child_process');

module.exports = function generateJsDoc(grunt, jsonInput, jsonOutput, cb) {
   grunt.file.mkdir(jsonOutput);

   grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации начато.');

   var jsDocWorker = child_process.spawn(path.join(__dirname, 'node.exe'), [
      path.join(__dirname, 'json-generation-env.js'),
      'input=' + jsonInput,
      'cache=' + jsonOutput
   ]);

   jsDocWorker.stdout.on('data', function(data) {
      console.log(data.toString());
   });

   jsDocWorker.stderr.on('data', function(data) {
      console.log('error: ', data.toString());
   });

   jsDocWorker.on('close', function(code) {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации выполнено.');

      grunt.log.ok('JSON generation process exited with code ' + code);

      cb();
   });
};