'use strict';

// подключение ws для gulp.
// данная версия загружает модули платформы из node_modules/sbis3_ws
// есть ещё версия для grunt

const path = require('path'),
   requireJS = require('requirejs'),
   logger = require('./../../lib/logger').logger();

const dblSlashes = /\\/g;

const appRoot = path.join(__dirname, '../../node_modules').replace(dblSlashes, '/'),
   wsRoot = '/sbis3-ws/ws/',
   resourceRoot = '/';

const wsLogger = {
   error(tag, msg, err) {
      let stack = '';
      if (err && err.hasOwnProperty('stack')) {
         stack = `: ${err.stack}`;
      }
      logger.info(`WS error: ${tag}::${msg}${stack}`);
   },
   info(tag, msg) {
      logger.debug(`WS info: ${tag}::${msg}`);
   },
   log(tag, msg) {
      logger.debug(`WS log: ${tag}::${msg}`);
   }
};

function removeLeadingSlash(filePath) {
   let resultPath = filePath;
   if (resultPath) {
      const head = resultPath.charAt(0);
      if (head === '/' || head === '\\') {
         resultPath = resultPath.substr(1);
      }
   }
   return resultPath;
}

function _init() {
   global.wsConfig = {
      appRoot,
      wsRoot,
      resourceRoot
   };
   global.wsBindings = {
      ITransport() {
         const e = new Error();
         throw new Error(`ITransport is not implemented in build environment.${e.stack}`);
      },
      ILogger() {
         return wsLogger;
      }
   };
   global.rk = function(key) {
      let resultKey = key;
      const index = resultKey.indexOf('@@');
      if (index > -1) {
         resultKey = resultKey.substr(index + '@@'.length);
      }
      return resultKey;
   };
   global.requirejs = requireJS;
   global.define = requireJS.define;
   const requireJSConfig = require(path.join(appRoot, wsRoot, 'ext/requirejs/config.js'));
   const config = requireJSConfig(appRoot, removeLeadingSlash(wsRoot), removeLeadingSlash(resourceRoot), {
      waitSeconds: 20,
      nodeRequire: require
   });
   global.requirejs = requireJS.config(config);
   global.requirejs(path.join(appRoot, wsRoot, 'lib/core.js'));
   global.requirejs('Core/core');
   const loadContents = global.requirejs('Core/load-contents');
   const appContents = {
      'jsModules': {},
      'modules': {
         'View': 'sbis3-ws/View',
         'Controls': 'sbis3-controls/Controls',
         'WS.Data': 'ws-data/WS.Data'
      },
      'requirejsPaths': {
         'View': 'sbis3-ws/View',
         'Controls': 'sbis3-controls/Controls',
         'WS.Data': 'ws-data/WS.Data'
      }
   };
   loadContents(appContents, true, { service: appRoot });
}

let initialized = false;
module.exports = {
   init() {
      try {
         if (!initialized) {
            _init();
            initialized = true;
         }
      } catch (e) {
         e.message = `Ошибка инициализации ядра платформы WS: ${e.message}`;
         throw e;
      }
   }
};
