var path = require('path'),
    fs = require('fs'),
    node_modules = path.resolve('node_modules'),
    child_process = require('child_process');

function rmdir(dir) {
   var list = fs.readdirSync(dir);
   for (var i = 0; i < list.length; i++) {
      if (list[i] !== "." && list[i] !== "..") {
         var filename = path.join(dir, list[i]);
         var stat = fs.statSync(filename);
         if (stat.isDirectory()) {
            rmdir(filename);
         } else {
            fs.unlinkSync(filename);
         }
      }
   }
   fs.rmdirSync(dir);
}

module.exports = function generateJsDoc(grunt, jsonInput, ws, jsonOutput, cb) {
   grunt.file.mkdir(jsonOutput);

   grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации начато.');

   //если не передать окружение, падает запуск jsDoc в sbis3-json-generator
   var env = process.env;
   env.WS = ws;
   env.OUTPUT = jsonOutput;
   env.INPUT = jsonInput;
   var jsDocWorker = child_process.spawn(path.join(__dirname, 'node.exe'), [
      path.join(__dirname, 'json-generation-env.js')
   ], {
      env: env
   });

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

      try {
         rmdir(jsonOutput);
         //grunt.file.delete(jsonOutput, {force: true});
      } catch(error) {
         grunt.log.warn(error);
      }
   });
};