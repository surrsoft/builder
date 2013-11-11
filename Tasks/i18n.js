var helpers = require('../lib/i18n.js');

module.exports = function(grunt) {

   grunt.registerMultiTask('i18n', 'Translate static', function() {
      var needSplit = grunt.option('translate'),
          indexDict = grunt.option('index-dict'),
          application = this.data.application;

      if (needSplit || indexDict) {
         helpers.findDictionary(grunt, this.data.dict || ['**/resources/lang/*.json']);
      }

      if (needSplit) {
         if (typeof needSplit === 'string') {
            if (needSplit === 'all') {
               helpers.translateAll(grunt, application);
            } else {
               helpers.translateOne(grunt, needSplit, application);
            }
         }

         // Заменим только html в статике по умолчанию
         helpers.translateDef(grunt, application);
      }

      if (indexDict) {
         helpers.indexDict(grunt, application);
      }

      return true;
   });
};