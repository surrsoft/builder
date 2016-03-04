(function() {

   'use strict';
   var
      global = (function(){ return this || (0,eval)('this'); }()),
      define = global.define || (global.requirejs && global.requirejs.define),
      host = typeof window !== 'undefined' ? window.location.hostname : '',
      devPrefixes = ['dev', 'test', 'fix', 'platform'],
      xpPrefix = host.substr(0, 3) == 'xp-' ? 'xp-' : '',
      devPrefix = (xpPrefix ? host.replace(xpPrefix, '') : host).split('.')[0].split('-')[0],
      prefix = host.indexOf('local') !== -1 ? 'dev-' : '';

   for (var i = 0, l = devPrefixes.length; i < l; i++) {
      if (devPrefix == devPrefixes[i]) {
         prefix = devPrefixes[i] + '-';
         break;
      }
   }

   var CDN_BASE = 'cdn.sbis.ru';

   function createCDNUrl(path) {
      return '//' + xpPrefix + prefix + CDN_BASE + path;
   }

   define('cdn', {
      load: function (name, require, onLoad) {
         if (typeof window !== 'undefined') {
            require([ createCDNUrl(name) ], onLoad, function(err){
               onLoad.error(err);
            });
         } else {
            onLoad('');
         }
      }
   });
}());