var helpers = require('../lib/i18n.js'),
    helpers2 = require('../lib/i18n-prepare.js');

module.exports = function(grunt) {

   grunt.registerMultiTask('i18n', 'Translate static', function() {
      var translate = grunt.option('translate'),
          indexDict = grunt.option('index-dict'),
          prepare = grunt.option('prepare-xhtml'),
          application = this.data.application;

      if (prepare) {
         helpers2.prepareXHTML(grunt, application);
      }

      if (translate) {
         helpers.findDictionary(grunt, this.data.dict, application);

         if (typeof translate === 'string') {
            if (translate === 'all') {
               helpers.translateAll(grunt, application);
            } else {
               helpers.translateOne(grunt, translate, application);
            }
         }

         // Заменим только html в статике по умолчанию
         helpers.translateDef(grunt, application);
      }

      if (indexDict) {
         helpers.indexDict(grunt, this.data.dict, application);
      }

      return true;
   });
};