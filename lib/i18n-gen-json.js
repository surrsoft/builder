var child_process = require('child_process');

(function () {

   "use strict";

   module.exports = {
      /**
       * Генерирует JSON файлы
       * @param grunt
       * @param task
       */
      genJSON: function(grunt, task) {
         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации начато.');

         var out = grunt.option('out').replace(/"/g, ''),
             ws = grunt.option('ws').replace(/"/g, ''),
             cloud = grunt.option('cloud').replace(/"/g, '');

         if (!out) {
            grunt.log.error('Parameter "out" is not find');
            return;
         }

         if (!ws) {
            grunt.log.error('Parameter "ws" is not find');
            return;
         }

         if (!cloud) {
            grunt.log.error('Parameter "cloud" is not find');
            return;
         }

         var done = task.async();

         child_process.exec(__dirname + "/../node_modules/sbis3-genie-server/bin/node.exe " + __dirname + "/json-generation-env", {
            env: {
               WS: ws,
               CLOUD: cloud,
               OUTPUT: out
            }
         }, function(error) {
            if (error) {
               grunt.log.error(error);
            }

            grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации выполнено.');
            done();
         });
      }
   }
})();