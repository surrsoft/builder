var path = require('path');
var dblSlashes = /\\/g;

module.exports = function(grunt) {
   var ver = process.versions.node;

   if (ver.split('.')[0] < 4) {
      console.error('nodejs >= v4.x required');
      process.exit(1);
   }

   // Read options
   var root = grunt.option('root') || '';
   var app = grunt.option('application') || '/';
   var versionize = grunt.option('versionize');
   var packaging = grunt.option('package');

   // Init environment
   var target = path.resolve(root);
   var application = path.join('/', app, '/').replace(dblSlashes, '/');
   require('./lib/logger').setGruntLogger(grunt);
   global.grunt = grunt; //это нужно для поддержки логов в grunt-wsmod-packer

   var configBuilder = require('./lib/config-builder.js');

   process.env.ROOT = target;
   process.env.APPROOT = app;

   grunt.option('color', process.stdout.isTTY);

   // Load tasks
   grunt.loadNpmTasks('grunt-wsmod-packer');
   grunt.loadNpmTasks('grunt-text-replace');
   grunt.loadNpmTasks('grunt-contrib-cssmin');

   grunt.loadTasks('Tasks');

   // Init config
   grunt.file.mkdir(target);
   grunt.file.setBase(target);
   grunt.initConfig(configBuilder(grunt, target, application));

   var defaultTasks = [];

   if (packaging) {
      defaultTasks.push('deanonymize');
   }

   if (versionize && typeof versionize == 'string') {
      defaultTasks.push('replace:core', 'replace:css', 'replace:res', 'ver-contents');
   }

   defaultTasks.push('i18n', 'collect-dependencies', 'routsearch', 'less1by1');

   //таска replace:html, реализующая версионирование для html и tmpl, должна выполняться перед таской owndepspack
   if (packaging) {
      defaultTasks.push('cssmin', 'xhtmlmin', 'tmplmin', 'tmpl-build', 'xhtml-build');
      if (versionize && typeof versionize == 'string') {
         defaultTasks.push('replace:html');
      }

      /**
       * выполняем задачу минификации до какой-либо паковки. Минификатор физически не вывозит столь огромный объём
       * js-кода и сваливается через долгое время по таймауту, причём без ошибок.
       */
      defaultTasks.push('uglify', 'packjs', 'packcss', 'owndepspack', 'custompack', 'packwsmod', 'gzip');
   }

   if (!packaging && versionize && typeof versionize == 'string') {
      defaultTasks.push('replace:html');
   }

   grunt.fail.warn = grunt.fail.fatal;

   grunt.registerTask('default', defaultTasks);

   grunt.log.ok('SBIS3 Builder v' + require(path.join(__dirname, 'package.json')).version);
};

if (require.main == module) {
   console.log(require(require('path').join(__dirname, 'package.json')).version.split('-')[0]);
}
