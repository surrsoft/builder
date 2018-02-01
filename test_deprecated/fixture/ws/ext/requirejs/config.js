(function() {
   var global = (function() {
      return this || (0, eval)('this'); 
   }());
   var wsPath = ((global.wsConfig ? global.wsConfig.WSRootPath || global.wsConfig.wsRoot : undefined) || '/ws/').replace(/^\//, '');
   var resourcesPath = ((global.wsConfig ? global.wsConfig.ResourcePath || global.wsConfig.resourceRoot : undefined) || '/resources/').replace(/^\//, '');
   var pathjoin;
   var cacheSettings = {
      buildnumber: ''
   };

   if (typeof module !== 'undefined') {
      pathjoin = require('path').join;
   } else {
      function removeLeadingSlash(path) {
         if (path) {
            var head = path.charAt(0);
            if (head == '/' || head == '\\') {
               path = path.substr(1);
            }
         }
         return path;
      }

      function removeTrailingSlash(path) {
         if (path) {
            var tail = path.substr(-1);
            if (tail == '/' || tail == '\\') {
               path = path.substr(0, path.length - 1);
            }
         }
         return path;
      }

      pathjoin = function(path1, path2) {
         return removeTrailingSlash(path1) + '/' + removeLeadingSlash(path2);
      };
   }

   function createRequirejsConfig(baseUrl, wsPath, resourcesPath, options) {
      var cfg = {
         baseUrl: baseUrl,
         paths: {
            'Lib': pathjoin(wsPath, 'lib'),
            'Ext': pathjoin(wsPath, 'lib/Ext'),
            'Core': pathjoin(wsPath, 'core'),
            'Resources': resourcesPath,
            'css': pathjoin(wsPath, 'ext/requirejs/plugins/css'),
            'js': pathjoin(wsPath, 'ext/requirejs/plugins/js'),
            'native-css': pathjoin(wsPath, 'ext/requirejs/plugins/native-css'),
            'normalize': pathjoin(wsPath, 'ext/requirejs/plugins/normalize'),
            'html': pathjoin(wsPath, 'ext/requirejs/plugins/html'),
            'tmpl': pathjoin(wsPath, 'ext/requirejs/plugins/tmpl'),
            'text': pathjoin(wsPath, 'ext/requirejs/plugins/text'),
            'is': pathjoin(wsPath, 'ext/requirejs/plugins/is'),
            'is-api': pathjoin(wsPath, 'ext/requirejs/plugins/is-api'),
            'i18n': pathjoin(wsPath, 'ext/requirejs/plugins/i18n'),
            'json': pathjoin(wsPath, 'ext/requirejs/plugins/json'),
            'order': pathjoin(wsPath, 'ext/requirejs/plugins/order'),
            'template': pathjoin(wsPath, 'ext/requirejs/plugins/template'),
            'cdn': pathjoin(wsPath, 'ext/requirejs/plugins/cdn'),
            'datasource': pathjoin(wsPath, 'ext/requirejs/plugins/datasource'),
            'bootup': pathjoin(wsPath, 'res/js/bootup'),
            'xml': pathjoin(wsPath, 'ext/requirejs/plugins/xml'),
            'preload': pathjoin(wsPath, 'ext/requirejs/plugins/preload'),
            'browser': pathjoin(wsPath, 'ext/requirejs/plugins/browser')
         },
         testing: typeof jstestdriver !== 'undefined',
         waitSeconds: 60
      };

      if (typeof window !== 'undefined' && cacheSettings.buildnumber) {
         cfg.cacheSuffix = '.v' + cacheSettings.buildnumber;
      }

      if (options) {
         for (var prop in options) {
            if (options.hasOwnProperty(prop)) {
               cfg[prop] = options[prop];
            }
         }
      }

      return cfg;
   }

   global.requirejs.config(createRequirejsConfig('/', wsPath, resourcesPath));

   if (typeof module !== 'undefined') {
      module.exports = createRequirejsConfig;
   }
}());
