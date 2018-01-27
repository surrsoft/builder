'use strict';

//заменяет node-ws.js из grunt-wsmod-packer
//данная версия загружает модули платформы из node_modules/sbis3_ws

const path = require('path'),
   requireJS = require('requirejs'),
   logger = require('./../../lib/logger').logger;

const dblSlashes = /\\/g;

const appRoot = path.join(__dirname, '../../node_modules/sbis3-ws').replace(dblSlashes, '/'),
   wsRoot = '/ws/',
   resourceRoot = '/';

function removeLeadingSlash(path) {
   if (path) {
      const head = path.charAt(0);
      if (head === '/' || head === '\\') {
         path = path.substr(1);
      }
   }
   return path;
}

module.exports = {
   init: function() {

      const wsLogger = {
         error: function(tag, msg, e) {
            logger.error(tag + ':: ' + msg + (e ? ('. ' + e.message) : ''));
         },
         info: function(tag, msg) {
            logger.info(tag + ':: ' + msg);
         },
         log: function(tag, msg) {
            logger.debug(tag + ':: ' + msg);
         }
      };
      global.wsConfig = {
         appRoot: appRoot,
         wsRoot: wsRoot,
         resourceRoot: resourceRoot
      };
      global.wsBindings = {
         ITransport: function() {
            const e = new Error();
            throw new Error('ITransport is not implemented in build environment.' + e.stack);
         },
         ILogger: function() {
            return wsLogger;
         }
      };
      global.rk = function(key) {
         const index = key.indexOf('@@');
         if (index > -1) {
            key = key.substr(index + '@@'.length);
         }
         return key;
      };
      global.requirejs = requireJS;
      global.define = requireJS.define;
      const requireJSConfig = require(path.join(appRoot, wsRoot, 'ext/requirejs/config.js'));
      const requirejs = requireJS.config(requireJSConfig(appRoot, removeLeadingSlash(wsRoot), removeLeadingSlash(resourceRoot), {
         waitSeconds: 20,
         nodeRequire: require
      }));
      requirejs(path.join(appRoot, wsRoot, 'lib/core.js'));
   }
};
