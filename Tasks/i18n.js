var indexDict = require('../lib/i18n.js').indexDict,
    prepareXHTML = require('../lib/i18n-prepare.js').prepareXHTML,
    createResultDict = require('../lib/i18n-dict.js').createResultDict,
    packageDictionary = require('../lib/i18n-packer.js').packageDictionary,
    generateJSON = require('../lib/i18n-gen-json.js').genJSON;

module.exports = function(grunt) {

   grunt.registerMultiTask('i18n', 'Translate static', function() {
      var languages = grunt.option('index-dict'),
          prepare = grunt.option('prepare-xhtml'),
          packer = grunt.option('package'),
          makeDict = grunt.option('make-dict'),
          genJSON = grunt.option('gen-json'),
          application = this.data.application;

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача i18n.');

      if (genJSON) {
         generateJSON(grunt, this);
      }

      if (makeDict) {
         createResultDict(grunt, this);
      }

      if (prepare) {
         prepareXHTML(grunt, application);
      }

      if (languages) {
         indexDict(grunt, languages, this.data.dict, application);
      }

      if (packer) {
         packageDictionary(grunt, this.data, application);
      }

      grunt.log.ok(grunt.template.today('hh:MM:ss')+ ': Задача i18n выполнена.');

      return true;
   });
};