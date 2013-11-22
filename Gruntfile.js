module.exports = function(grunt) {

   var doConcat = grunt.option('concat');
   var path = require('path');
   var target = path.resolve(grunt.option('root'));
   var app = grunt.option('application') || '';
   var configBuilder = require('./lib/config-builder.js');
   var defaultTasks = ['packwsmod'];

   if (doConcat === true || doConcat === undefined) {
      defaultTasks.push('packjs', 'packcss');
   }
   defaultTasks.push('i18n');

   target = path.resolve(target) || '';

   process.env.WS = path.join(target, app, 'ws');

   grunt.option('color', !!process.stdout.isTTY);

   grunt.loadNpmTasks('grunt-packer');
   grunt.loadNpmTasks('grunt-wsmod-packer');
   grunt.loadNpmTasks('grunt-text-replace');

   grunt.loadTasks('tasks');

   grunt.file.setBase(target);

   grunt.initConfig(configBuilder(app));

   if (typeof grunt.option('versionize') == 'string') {
      defaultTasks.push('replace');
   }

   if (grunt.option('collect-dependencies')) {
      grunt.registerTask('default', [ 'collect-dependencies' ]);
   } else {
      grunt.registerTask('default', defaultTasks);
   }

};