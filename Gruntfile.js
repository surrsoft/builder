module.exports = function(grunt) {
   var ver = process.versions.node;

   if (ver.split('.')[0] < 1) {
      console.error('nodejs >= v1.x required');
      process.exit(1);
   }

   var path = require('path');

   // Read options
   var root = grunt.option('root') || '';
   var app = grunt.option('application') || '';
   var versionize = grunt.option('versionize');
   var packaging = grunt.option('package');
   var prepare_xhtml = grunt.option('prepare-xhtml');

   // Init environment
   var target = path.resolve(root);
   var configBuilder = require('./lib/config-builder.js');

   process.env.ROOT = target;
   process.env.APPROOT = path.join(target, app);
   process.env.WS = path.join(target, app, 'ws');
   process.env.RESOURCES = path.join(target, app, 'resources');

   grunt.option('color', !!process.stdout.isTTY);

   // Load tasks
   grunt.loadNpmTasks('grunt-packer');
   grunt.loadNpmTasks('grunt-wsmod-packer');
   grunt.loadNpmTasks('grunt-text-replace');
   grunt.loadNpmTasks('grunt-contrib-uglify');
   grunt.loadNpmTasks('grunt-contrib-cssmin');
   grunt.loadTasks('tasks');

   // Init config
   grunt.file.setBase(target);
   grunt.initConfig(configBuilder(grunt, app));

   var defaultTasks = [];

   if (packaging) {
      defaultTasks.push('deanonymize');
   }

   defaultTasks.push('i18n', 'collect-dependencies', 'routsearch');

   if (prepare_xhtml) {
      defaultTasks.push('replace:i18n');
   }

   if (typeof versionize == 'string') {
      defaultTasks.push('replace:core', 'replace:css', 'replace:res');
   }

   if (packaging) {
      defaultTasks.push('cssmin', 'uglify', 'xhtmlmin', 'packwsmod', 'packjs', 'packcss', 'owndepspack');
   }

   if (typeof versionize == 'string') {
      defaultTasks.push('replace:html');
   }

   grunt.fail.warn = grunt.fail.fatal;

   grunt.registerTask('default', defaultTasks);

   grunt.log.ok('SBIS3 Builder v' + require(path.join(__dirname, 'package.json')).version);
};

if (require.main == module) {
   console.log(require(require('path').join(__dirname, 'package.json')).version.split('-')[0]);
}
