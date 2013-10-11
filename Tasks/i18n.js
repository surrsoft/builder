var helpers = require('../lib/i18n.js');

module.exports = function(grunt) {

   grunt.registerMultiTask('i18n', 'Translate static', function() {
      var needSplit = grunt.option('translate'),
          indexDict = grunt.option('index-dict');

      if (needSplit || indexDict) {
         helpers.findDictionary(grunt, this.data.dict || ['**/lang/*.json']);
      }

      if (needSplit) {
         if (typeof needSplit === 'string') {
            if (needSplit === 'all') {
               helpers.translateAll(grunt);
            } else {
               helpers.translateOne(grunt, needSplit);
            }
         }

         // Заменим только html в статике по умолчанию
         helpers.translateDef(grunt);
      }

      if (indexDict) {
         helpers.indexDict(grunt);
      }

      return true;
   });
};