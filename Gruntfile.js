'use strict';

const path = require('path');
const dblSlashes = /\\/g;

module.exports = function(grunt) {
   try {
      const ver = process.versions.node;

      if (ver.split('.')[0] < 8) {
         //eslint-disable-next-line no-console
         console.error('nodejs >= v8.x required');
         process.exit(1);
      }

      // Read options
      const root = grunt.option('root') || '';
      const app = grunt.option('application') || '/';
      const versionize = grunt.option('versionize');
      const packaging = grunt.option('package');

      // Init environment
      const target = path.resolve(root);
      const application = path.join('/', app, '/').replace(dblSlashes, '/');
      require('./lib/logger').setGruntLogger(grunt);
      global.grunt = grunt; //это нужно для поддержки логов в grunt-wsmod-packer

      const configBuilder = require('./lib/config-builder.js');

      process.env.ROOT = target;
      process.env.APPROOT = app;

      grunt.option('color', process.stdout.isTTY);

      // Load tasks
      //для загрузки задач включаем verbose, чтобы видел stack ошибки, если вознкнет при require
      const oldVerbose = grunt.option('verbose');
      grunt.option('verbose', true);
      grunt.loadNpmTasks('grunt-wsmod-packer');
      grunt.loadNpmTasks('grunt-text-replace');
      grunt.loadNpmTasks('grunt-contrib-cssmin');
      grunt.loadTasks('Tasks');
      
      //TODO: ВЕРНУТЬ!
      //grunt.option('verbose', oldVerbose);

      // Init config
      grunt.file.mkdir(target);
      grunt.file.setBase(target);
      grunt.initConfig(configBuilder(grunt, target, application));

      const defaultTasks = [];

      if (packaging) {
         defaultTasks.push('deanonymize');
      }

      if (versionize && typeof versionize === 'string') {
         defaultTasks.push('replace:core', 'replace:css', 'replace:res', 'ver-contents');
      }

      defaultTasks.push('i18n', 'collect-dependencies', 'routsearch', 'less1by1');

      //таска replace:html, реализующая версионирование для html и tmpl, должна выполняться перед таской owndepspack
      if (packaging) {
         defaultTasks.push('cssmin', 'xhtmlmin', 'tmplmin', 'tmpl-build', 'xhtml-build');
         if (versionize && typeof versionize === 'string') {
            defaultTasks.push('replace:html');
         }

         /**
          * выполняем задачу минификации до какой-либо паковки. Минификатор физически не вывозит столь огромный объём
          * js-кода и сваливается через долгое время по таймауту, причём без ошибок.
          */
         defaultTasks.push('packjs', 'packcss', 'owndepspack', 'uglify', 'custompack', 'packwsmod', 'gzip');
      }

      if (!packaging && versionize && typeof versionize === 'string') {
         defaultTasks.push('replace:html');
      }

      grunt.fail.warn = grunt.fail.fatal;

      grunt.registerTask('default', defaultTasks);

      grunt.log.ok('SBIS3 Builder v' + require(path.join(__dirname, 'package.json')).version);

   } catch (error) {
      //eslint-disable-next-line no-console
      console.log('Критическая ошибка в работе builder\'а: ', error.stack);
   }
};

if (require.main === module) {
   //eslint-disable-next-line no-console
   console.log(require(require('path').join(__dirname, 'package.json')).version.split('-')[0]);
}
