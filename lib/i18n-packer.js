/**
 * Created by shilovda on 25.02.13.
 */

var path = require('path');

(function () {

   "use strict";

   var grunt;

   module.exports = {

      packageDictionary: function(g, application) {
         if (!g) {
            return;
         } else {
            grunt = g;
         }

         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Выполняется паковка словарей.');



         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Паковка словарей выполнена.');
      }
   }
})();