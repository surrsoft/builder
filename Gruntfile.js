module.exports = function(grunt) {
   var ver = process.versions.node;

   if (ver.split('.')[0] < 1) {
      console.error('nodejs >= v1.x required');
      process.exit(1);
   }

   var path = require('path');

   var logger = require('./lib/logger');
   logger.enable(grunt);

   // Read options
   var root = grunt.option('root') || '';
   var app = grunt.option('application') || '';
   var versionize = grunt.option('versionize');
   var packaging = grunt.option('package');

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
   grunt.loadNpmTasks('grunt-cleanempty');
   grunt.loadTasks('Tasks');

   // Init config
   grunt.file.mkdir(target);
   grunt.file.setBase(target);
   grunt.initConfig(configBuilder(grunt, app));

   var defaultTasks = [];

   defaultTasks.push('jsModules');

   if (packaging) {
      defaultTasks.push('deanonymize');
   }

   if (typeof versionize == 'string') {
      defaultTasks.push('replace:core', 'replace:css', 'replace:res', 'ver-contents');
   }

   defaultTasks.push('i18n', 'requirejsPaths', 'collect-dependencies', 'routsearch');

   if (packaging) {
      defaultTasks.push('cssmin', 'uglify', 'xhtmlmin', 'packwsmod', 'packjs', 'packcss', 'owndepspack', 'custompack');
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
