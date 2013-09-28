module.exports = function(grunt) {

   var path = require('path');
   var target = path.resolve(grunt.option('root'));
   var app = grunt.option('application') || '';
   var configBuilder = require('./lib/config-builder.js');

   target = path.resolve(target) || '';

   process.env.WS = path.join(target, app, 'ws');

   grunt.option('color', !!process.stdout.isTTY);

   grunt.loadNpmTasks('grunt-packer');
   grunt.loadNpmTasks('grunt-wsmod-packer');
   grunt.loadNpmTasks('grunt-text-replace');

   grunt.file.setBase(target);

   grunt.initConfig(configBuilder(app));

   grunt.registerTask('default', ['replace', 'packwsmod', 'packjs', 'packcss']);

};