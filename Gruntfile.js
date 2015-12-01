module.exports = function(grunt) {
   var path = require('path');

   // Read options
   var doConcat = grunt.option('concat');
   var root = grunt.option('root') || '';
   var app = grunt.option('application') || '';
   var copyWS = grunt.option('copyWS');
   var ignoreWS = grunt.option('ignore-ws');
   var versionize = grunt.option('versionize');
   var packaging = grunt.option('package');

   // Init environment
   var target = path.resolve(root);
   var configBuilder = require('./lib/config-builder.js');

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
   grunt.initConfig(configBuilder(grunt, app, ignoreWS));

   // New init tasks
   if (copyWS) {
      var defaultTasks = [];

      if (packaging) {
         defaultTasks.push('deanonymize');
      }

      defaultTasks.push('collect-dependencies');

      if (typeof versionize == 'string') {
         defaultTasks.push('replace:core', 'replace:css', 'replace:res');
      }

      if (packaging) {
         defaultTasks.push('packwsmod', 'cssmin', 'uglify', 'packjs', 'packcss', 'owndepspack');
      }

      if (typeof versionize == 'string') {
         defaultTasks.push('replace:html');
      }

      grunt.registerTask('default', defaultTasks);
   } else {
      grunt.log.error('Deprecated! Use --copyWS [--package=true, [--versionize="version_number"]] flags.');
      if (typeof versionize == 'string') {
         grunt.registerTask('default', ['replace']);
      } else if (grunt.option('collect-dependencies')) {
         grunt.registerTask('default', ['collect-dependencies']);
      } else {
         var packageTasks = (function() {
            var tasks = ['packwsmod', 'cssmin', 'uglify'];

            if (doConcat === true || doConcat === undefined) {
               tasks.push('packjs', 'packcss');
            }

            tasks.push('owndepspack');

            return tasks;
         })();
         grunt.registerTask('default', packageTasks);
      }
   }

   grunt.log.ok('SBIS3 Builder v' + require(path.join(__dirname, 'package.json')).version);
};

if (require.main == module) {
   console.log(require(require('path').join(__dirname, 'package.json')).version.split('-')[0]);
}
