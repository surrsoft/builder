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

module.exports = function generateJsDoc(grunt, cloud, ws, jsonOutput, cb) {
   if (!cloud) {
      grunt.fail.error('Parameter "cloud" is not find');
      return;
   }

   grunt.file.mkdir(jsonOutput);

   grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации начато.');
   var command_path = '"' + path.join(node_modules, 'sbis3-genie-server/bin/node.exe') +
                      '" "' + path.join(__dirname, 'json-generation-env.js') + '"';
   grunt.log.ok('Command path: ' + command_path);

   //если не передать окружение, падает запуск jsDoc в sbis3-json-generator
   var env = process.env;
   env.WS = ws;
   env.CLOUD = cloud;
   env.OUTPUT = jsonOutput;
   child_process.exec(command_path, {
      env: env
   }, function(error) {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации выполнено.');

      cb(error);

      try {
         rmdir(jsonOutput);
         //grunt.file.delete(jsonOutput, {force: true});
      } catch(error) {
         grunt.log.warn(error);
      }
   });
};