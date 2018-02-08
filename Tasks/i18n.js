'use strict';

const
   path = require('path'),
   logger = require('../lib/logger').logger(),
   indexDict = require('../lib/i18n/index-dictionary'),
   prepareXHTML = require('../lib/i18n/prepare-xhtml').prepareXHTML,
   createResultDict = require('../lib/i18n/create-result-dictionary'),
   runJsonGenerator = require('../lib/i18n/run-json-generator'),
   normalizeKeyDict = require('../lib/i18n/normalize-key');

module.exports = function(grunt) {
   grunt.registerMultiTask('i18n', 'Translate static', function() {
      logger.info(grunt.template.today('hh:MM:ss') + ': Запускается задача i18n.');

      const taskDone = this.async();
      let taskCount = 0;
      let isDone = false;

      let modules = grunt.option('modules');
      if (modules) {
         modules = modules.replace(/"/g, '');
      }
      let cache = grunt.option('json-cache');
      if (cache) {
         cache = cache.replace(/"/g, '');
      }
      const jsonOutput = cache || path.join(__dirname, '../../../../jsDoc-json-cache');

      //Приводит повторяющиеся ключи в словарях к единому значению
      grunt.option('index-dict') && normalizeKeyDict(grunt, this.data, grunt.option('index-dict'));

      if (grunt.option('json-generate')) {
         ++taskCount;
         runJsonGenerator(modules, jsonOutput)
            .then(null, (err) => {
               done(err);
            });
      }

      grunt.option('make-dict') && createResultDict(grunt, ++taskCount && done);

      grunt.option('prepare-xhtml') && prepareXHTML(grunt, this.data, ++taskCount && done);

      grunt.option('index-dict') && indexDict(grunt, grunt.option('index-dict'), this.data, ++taskCount && done);

      if (taskCount === 0) {
         done();
      }

      function done(err) {
         if (err) {
            logger.error({error: err});
         }

         if (!isDone && --taskCount <= 0) {
            logger.info(grunt.template.today('hh:MM:ss') + ': Задача i18n выполнена.');
            isDone = true;
            taskDone();
         }
      }

      return true;
   });
};
