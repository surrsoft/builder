'use strict';

const
   path = require('path'),
   indexDict = require('../lib/i18n/indexDictionary').indexDict,
   prepareXHTML = require('../lib/i18n/prepareXHTML').prepareXHTML,
   createResultDict = require('../lib/i18n/createResultDictionary').createResultDict,
   jsonGenerator = require('../lib/i18n/jsonGenerator'),
   normalizeKeyDict = require('../lib/i18n/normalizeKey').normalize;
module.exports = function(grunt) {
   grunt.registerMultiTask('i18n', 'Translate static', function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача i18n.');

      var taskDone = this.async();
      var taskCount = 0;
      var isDone = false;

      let modules = grunt.option('modules');
      if (modules) {
         modules = modules.replace(/"/g, '');
      }
      let cache = grunt.option('json-cache');
      if (cache) {
         cache = cache.replace(/"/g, '');
      }
      var jsonOutput = cache || path.join(__dirname, '../../../../jsDoc-json-cache');

      //Приводит повторяющиеся ключи в словарях к единому значению
      grunt.option('index-dict') && normalizeKeyDict(grunt, this.data, grunt.option('index-dict'));

      grunt.option('json-generate') && jsonGenerator.run(modules, jsonOutput, ++taskCount && done);

      grunt.option('make-dict') && createResultDict(grunt, ++taskCount && done);

      grunt.option('prepare-xhtml') && prepareXHTML(grunt, this.data, ++taskCount && done);

      grunt.option('index-dict') && indexDict(grunt, grunt.option('index-dict'), this.data, ++taskCount && done);

      if (taskCount === 0) {
         done();
      }

      function done(err) {
         if (err) {
            grunt.fail.fatal(err);
         }

         if (!isDone && --taskCount <= 0) {
            grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача i18n выполнена.');
            isDone = true;
            taskDone();
         }
      }

      return true;
   });
};
