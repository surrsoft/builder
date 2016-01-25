var indexDict = require('../lib/i18n/indexDictionary').indexDict,
    prepareXHTML = require('../lib/i18n/prepareXHTML').prepareXHTML,
    createResultDict = require('../lib/i18n/createResultDictionary').createResultDict;

module.exports = function(grunt) {

   grunt.registerMultiTask('i18n', 'Translate static', function() {
      var languages = grunt.option('index-dict'),
          prepare = grunt.option('prepare-xhtml'),
          makeDict = grunt.option('make-dict'),
          application = this.data.application;

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача i18n.');

      if (makeDict) {
         createResultDict(grunt, this);
      }

      if (prepare) {
         prepareXHTML(grunt, application, this);
      }

      if (languages) {
         indexDict(grunt, languages, this.data.dict, application);
      }

      grunt.log.ok(grunt.template.today('hh:MM:ss')+ ': Задача i18n выполнена.');

      return true;
   });
};