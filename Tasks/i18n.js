var helpers = require('../lib/i18n.js');

module.exports = function(grunt) {

   grunt.registerMultiTask('i18n', 'Translate static', function() {
      var needSplit = grunt.option('translate'),
          indexDict = grunt.option('index-dict');

      if (needSplit || indexDict) {
         helpers.findDictionary(grunt, this.data.dict || ['**/resources/lang/*.json']);
      }

      if (needSplit) {
         if (typeof needSplit === 'string') {
            if (needSplit === 'all') {
               helpers.translateAll(grunt, this.data.application);
            } else {
               helpers.translateOne(grunt, needSplit, this.data.application);
            }
         }

         // Заменим только html в статике по умолчанию
         helpers.translateDef(grunt, this.data.application);
      }

      if (indexDict) {
         helpers.indexDict(grunt, this.data.application);
      }

      return true;
   });
};