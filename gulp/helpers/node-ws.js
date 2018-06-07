'use strict';

// подключение ws для gulp.
// данная версия загружает модули платформы из node_modules/sbis3_ws
// есть ещё версия для grunt

const path = require('path'),
   requireJS = require('requirejs'),
   logger = require('../../lib/logger').logger();

const dblSlashes = /\\/g;

const appRoot = path.join(__dirname, '../../node_modules').replace(dblSlashes, '/'),
   wsRoot = '/sbis3-ws/ws/',
   resourceRoot = '/';

const formatMessage = function(message) {
   if (typeof message === 'string') {
      return message;
   }
   return JSON.stringify(message);
};

let logMessages = [];
const wsLogger = {
   error(tag, msg, err) {
      // ошибки от ядра выводим пока как warning.
      // сначала нужно проверить, что сообщения от WS могут быть полезны в принципе.
      // не роняем сборку, а аккуратно и постепенно вычищаем от ошибок.
      logger.warning({
         error: err,
         message: `WS error::${tag}::${formatMessage(msg)}`
      });
   },
   warn(tag, msg, err) {
      logger.warning({
         error: err,
         message: `WS warning::${tag}::${formatMessage(msg)}`
      });
   },
   info(tag, msg) {
      logger.warning({

         message: `WS::${tag}::${formatMessage(msg)}`
      });
   },
   log(tag, msg) {
      logMessages.push({
         level: 'debug',
         message: `WS::${tag}::${formatMessage(msg)}`
      });
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

function initWs() {
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
   global.rk = function rk(key) {
      let resultKey = key;
      const index = resultKey.indexOf('@@');
      if (index > -1) {
         resultKey = resultKey.substr(index + '@@'.length);
      }
      return resultKey;
   };
   global.requirejs = requireJS;
   global.define = requireJS.define;

   // eslint-disable-next-line global-require
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
      jsModules: {},
      modules: {
         View: 'sbis3-ws/View',
         Controls: 'sbis3-controls/Controls',
         'WS.Data': 'ws-data/WS.Data'
      },
      requirejsPaths: {
         View: 'sbis3-ws/View',
         Controls: 'sbis3-controls/Controls',
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
            initWs();
            initialized = true;
         }
      } catch (e) {
         e.message = `Ошибка инициализации ядра платформы WS: ${e.message}`;
         throw e;
      }
   },
   getWSLogMessages() {
      return [...logMessages];
   },
   resetWSLogMessages() {
      logMessages = [];
   }
};
