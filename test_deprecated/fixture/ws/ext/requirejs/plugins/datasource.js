(function() {

   'use strict';
   var global = (function() {
         return this || (0, eval)('this'); 
      }()),
      define = global.define || (global.requirejs && global.requirejs.define);

   define('datasource', ['text'], function() {
      return {
         load: function(name, require, onLoad, conf) {
            try {
               var path = $ws.helpers.requirejsPathResolver(name, 'dpack');
               require(['text!' + path], function(json) {
                  var parsedData = {};
                  try {
                     parsedData = JSON.parse(json);
                  } catch (e) {
                     $ws.single.ioc.resolve('ILogger').log('Core', 'Datasource format for ' + name + ' parse failed');
                  }
                  onLoad(parsedData);
               }, function() {
                  $ws.single.ioc.resolve('ILogger').log('Core', 'DataSource ' + name + ' load failed');
                  onLoad({});
               });
            } catch (err) {
               onLoad.error(err);
            }
         }
      };
   });
}());
