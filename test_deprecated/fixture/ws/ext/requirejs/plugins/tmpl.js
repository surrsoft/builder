(function() {

   'use strict';

   var global = (function() {
         return this || (0, eval)('this'); 
      }()),
      define = global.define || (global.requirejs && global.requirejs.define);

   /**
     * Поддерживаемые форматы запроса
     * - tmpl!SBIS3.CORE.HTMLChunk - подключит шаблон
     */
   define('tmpl', ['js!Core/tmpl/tmpl', 'js!View/config'], function(tmpl, config) {
      function resolverControls(path) {
         return 'js!' + path;
      }
      return {
         load: function(name, require, load) {
            try {
               var path = $ws.helpers.requirejsPathResolver(name, 'tmpl');
               require(['text!' + path], function(html) {
                  var conf = { config: config, filename: path };
                  try {
                     tmpl.template(html, resolverControls, conf).handle(function(traversed) {
                        load(function loadTemplateData(data) {
                           return tmpl.html(traversed, data, conf);
                        });
                     });
                  } catch (e) {
                     e.message = 'Error while creating template ' + name + '\n' + e.message + '\n' + e.stack;
                     load.error(e);
                  }
               }, function(e) {
                  e.message = 'Error while loading template ' + name + '\n' + e.message + '\n' + e.stack;
                  load.error(e);
               });
            } catch (e) {
               e.message = 'Error while resolving template ' + name + '\n' + e.message + '\n' + e.stack;
               load.error(e);
            }
         }
      };
   });
})();
