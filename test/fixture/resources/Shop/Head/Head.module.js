/**
 * @author Быканов А.А.
 */
define('js!SBIS3.MySite.Head', ['js!SBIS3.CORE.CompoundControl', 'html!SBIS3.MySite.Head', 'css!SBIS3.MySite.Head', 'js!SBIS3.MySite.Head/resources/SubHead'], function(CompoundControl, dotTplFn) {
   /**
    * SBIS3.MySite.Head
    * @class SBIS3.MySite.Head
    * @extends $ws.proto.CompoundControl
    */
   var moduleClass = CompoundControl.extend(/** @lends SBI0S3.MySite.Head.prototype */{
      _dotTplFn: dotTplFn,
      $protected: {
         _options: {
            /**
             * @cfg {String} Текст всплывающей подсказки
             * <wiTag group="Отображение">
             * @remark
             * Текст простой всплывающей подсказки при наведении курсора мыши.
             * @example
             * Каждому флагу установить всплывающую подсказку как подпись флага.
             * <pre>
             *    var names = groupCheckbox.getValue().getColumns();
             *    $ws.helpers.forEach(names, function(element) {
             *       var flag = groupCheckbox.getChildControlByName(element);
             *       flag.setTooltip(flag.getFlagCaption(element));
             *    });
             * </pre>
             * @translatable
             * @see setTooltip
             * @see getTooltip
             */
            tooltip: ''

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