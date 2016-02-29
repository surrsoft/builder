/**
 * @author Быканов А.А.
 */
define('js!SBIS3.MySite.Index', ['js!SBIS3.CORE.CompoundControl', 'html!SBIS3.MySite.Index', 'js!SBIS3.MySite.Head', 'css!SBIS3.MySite.Index'], function(CompoundControl, dotTplFn) {
   /**
    * SBIS3.MySite.Index
    * @class SBIS3.MySite.Index
    * @extends $ws.proto.CompoundControl
    */
   var moduleClass = CompoundControl.extend(/** @lends SBIS3.MySite.Index.prototype */{
      _dotTplFn: dotTplFn,
      $protected: {
         _options: {
            
         }
      },
      $constructor: function() {
      },

      init: function() {
         moduleClass.superclass.init.call(this);
      }
   });

   return moduleClass;
});