/**
 * Helpers
 */

'use strict';

// Speed up calls to hasOwnProperty
var
   hasOwnProperty = Object.prototype.hasOwnProperty;

const
   pathSep = /[/\\]/,
   fromResources = /[/\\]resources[/\\]/;

module.exports = {
   /**
    * Checks whether object is empty
    * @param obj {Object} - object to check
    * @returns {boolean}
    */
   isEmpty: function (obj) {
      // null and undefined are "empty"
      if (obj == null) return true;

      // Assume if it has a length property with a non-zero value
      // that that property is correct.
      if (obj.length > 0)    return false;
      if (obj.length === 0)  return true;

      // Otherwise, does it have any properties of its own?
      for (var key in obj) {
         if (hasOwnProperty.call(obj, key)) return false;
      }

      return true;
   },

   /**
    * Checks whether file belongs to specified module
    * @param moduleName {String} - current module name
    * @param initialModuleName {String} - initial module name
    * @returns {boolean}
    */
   belongs: function (moduleName, initialModuleName, contents) {
      var
         definitions = moduleName.split('!'),
         /*prefix = definitions[0],*/
         name = definitions[1] ? definitions[1].split(pathSep)[0] : definitions[0];

      if (contents[name]) {
         // this is another module
         return false;
      } else if(name === initialModuleName) {
         return true;
      } else {
         // FIXME: it must be placed into the resources folder
         return true;
      }
   },

   pathSep: pathSep
};