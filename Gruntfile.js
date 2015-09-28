module.exports = function(grunt) {

   var doConcat = grunt.option('concat');
   var path = require('path');
   var target = path.resolve(grunt.option('root') || '');
   var app = grunt.option('application') || '';
   var configBuilder = require('./lib/config-builder.js');
   var defaultTasks = ['collect-dependencies', 'packwsmod', 'cssmin', 'uglify'];

   if (doConcat === true || doConcat === undefined) {
      defaultTasks.push('packjs', 'packcss');
   }

   defaultTasks.push('owndepspack');

   process.env.WS = path.join(target, app, 'ws');
   process.env.RESOURCES = path.join(target, app, 'resources');

   grunt.option('color', !!process.stdout.isTTY);

   grunt.loadNpmTasks('grunt-packer');
   grunt.loadNpmTasks('grunt-wsmod-packer');
   grunt.loadNpmTasks('grunt-text-replace');

   grunt.loadNpmTasks('grunt-contrib-uglify');
   grunt.loadNpmTasks('grunt-contrib-cssmin');

   grunt.loadTasks('tasks');

   grunt.file.setBase(target);

   grunt.initConfig(configBuilder(app));

   if (typeof grunt.option('versionize') == 'string') {
      grunt.registerTask('default', ['replace']);
   } else if (grunt.option('collect-dependencies')) {
      grunt.registerTask('default', ['collect-dependencies']);
   } else {
      grunt.registerTask('default', defaultTasks);
   }

   grunt.log.ok('SBIS3 Builder v' + require(path.join(__dirname, 'package.json')).version);

};

if (require.main == module) {
   console.log(require(require('path').join(__dirname, 'package.json')).version.split('-')[0]);
}
