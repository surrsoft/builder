'use strict';

// подключение ws для grunt.
// данная версия загружает модули платформы из развернутого стенда
// есть ещё версия для gulp


// /////////////////////////
// Это здесь нужно, потому что внутри они переопределяют require, и портят наш requirejs
// Surprise MF
// /////////////////////////
require('esprima');
require('escodegen');
require('estraverse');

// /////////////////////////

const path = require('path'),
   fs = require('fs-extra');

const dblSlashes = /\\/g;

// Это физический путь до корня статики
const root = process.env.ROOT || path.join(process.cwd(), '..', '..');

// Относительные пути от корня сайта

const appRoot = path.join(process.env.APPROOT, path.sep).replace(dblSlashes, '/');

// При распили ядра на отдельные интрефейсные модули возникла проблема с доступностью некоторых модулей уехавших из ws.
// Напряляем require в правильном направление.
const existWsCore = fs.existsSync(path.join(root, 'WS.Core'));
const wsRoot = path.join(appRoot, existWsCore ? 'WS.Core' : 'ws', path.sep).replace(dblSlashes, '/');
const resourceRoot = existWsCore ? '.' : path.join(appRoot, 'resources', path.sep).replace(dblSlashes, '/');
const requireJS = require('requirejs');
const logger = require('./../../lib/logger').logger();

function removeLeadingSlash(path) {
   if (path) {
      const head = path.charAt(0);
      if (head === '/' || head === '\\') {
         path = path.substr(1);
      }
   }
   return path;
}

const wsLogger = {
   error(tag, msg) {
      logger.info(`WS error: ${tag}::${msg}`);
   },
   info(tag, msg) {
      logger.debug(`WS info: ${tag}::${msg}`);
   },
   log(tag, msg) {
      logger.debug(`WS log: ${tag}::${msg}`);
   }
};

let isInit = false;
module.exports = function() {
   if (!isInit) {
      isInit = true;

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
         const index = key.indexOf('@@');
         if (index > -1) {
            key = key.substr(index + '@@'.length);
         }
         return key;
      };
      global.requirejs = requireJS;
      global.define = requireJS.define;
      const requirejsConfig = require(path.join(root, wsRoot, 'ext/requirejs/config.js'));
      const requirejs = requireJS.config(requirejsConfig(root, removeLeadingSlash(wsRoot), removeLeadingSlash(resourceRoot), {
         waitSeconds: 20,
         nodeRequire: require
      }));
      requirejs(path.join(root, wsRoot, 'lib/core.js'));
      const ws = requirejs('Core/core');
      const loadContents = requirejs('Core/load-contents');
      try {
         const appContents = require(path.join(root, resourceRoot, 'contents.json'));
         loadContents(appContents, true, { service: appRoot });
      } catch (err) {
         // eslint-disable-next-line no-console
         console.log('ws initialized without contents.json');
      }
      global.$ws = ws;
   }
   return global.$ws;
};
