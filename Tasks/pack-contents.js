/**
 * Index
 */

'use strict';

var
   packerModule = require('./../lib/pack-contents/packer'),
   util = require('util');



module.exports = function(grunt) {
   grunt.registerMultiTask('pack-contents', 'pack contents, following some principles of determining way', function() {
      var
         packer = new packerModule(grunt, this.data),
         done = this.async();

      grunt.log.ok(util.format('%d | %s | Запускается задача pack-contents.',
         process.pid,
         grunt.template.today('hh:MM:ss')
      ));

      packer.run(function() {
         grunt.log.ok(util.format('%d | %s | Задача pack-contents выполнена.',
            process.pid,
            grunt.template.today('hh:MM:ss')
         ));

         done();
      });
   });
};

