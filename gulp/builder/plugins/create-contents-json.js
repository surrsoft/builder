/**
 * Плагин для создания contents.json и contents.js (информация для require, описание локализации и т.д.)
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger(),
   path = require('path'),
   helpers = require('../../../lib/helpers');

/**
 * Объявление плагина
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {stream}
 */
module.exports = function declarePlugin(taskParameters, moduleInfo) {
   if (
      taskParameters.config.joinedMeta &&
      !taskParameters.config.commonContents
   ) {
      taskParameters.config.commonContents = {};
   }
   return through.obj(
      function onTransform(file, encoding, callback) {
         callback(null, file);
      },

      /* @this Stream */
      function onFlush(callback) {
         try {
            // подготовим contents.json и contents.js
            if (taskParameters.config.version) {
               moduleInfo.contents.buildnumber = `%{MODULE_VERSION_STUB=${path.basename(moduleInfo.output)}}`;
            }

            // сохраняем модульный contents в общий, если необходимо
            if (taskParameters.config.joinedMeta) {
               helpers.joinContents(taskParameters.config.commonContents, moduleInfo.contents);
            }

            const contentsModuleName = Object.keys(moduleInfo.contents.modules)[0];
            const newThemesModules = taskParameters.cache.getNewThemesModulesCache(moduleInfo.name);
            if (Object.keys(newThemesModules).length > 0) {
               moduleInfo.contents.modules[contentsModuleName].newThemes = newThemesModules;
            }

            const contentsJsFile = new Vinyl({
               path: 'contents.js',
               contents: Buffer.from(`contents=${JSON.stringify(helpers.sortObject(moduleInfo.contents))}`),
               moduleInfo,
               compiled: true
            });
            const contentsJsonFile = new Vinyl({
               path: 'contents.json',
               contents: Buffer.from(JSON.stringify(helpers.sortObject(moduleInfo.contents), null, 2)),
               moduleInfo,
               compiled: true
            });
            const
               currentModuleName = helpers.prettifyPath(moduleInfo.output).split('/').pop(),
               moduleMeta = JSON.stringify(moduleInfo.contents.modules[currentModuleName]),
               moduleMetaContent = `define('${currentModuleName}/.builder/module',[],function(){return ${moduleMeta};});`;

            const moduleMetaFile = new Vinyl({
               path: '.builder/module.js',
               contents: Buffer.from(moduleMetaContent),
               moduleInfo,
               compiled: true
            });
            const moduleMetaMinFile = new Vinyl({
               path: '.builder/module.min.js',
               contents: Buffer.from(moduleMetaContent),
               moduleInfo,
               compiled: true
            });
            this.push(contentsJsFile);
            this.push(contentsJsonFile);
            this.push(moduleMetaFile);
            this.push(moduleMetaMinFile);
         } catch (error) {
            logger.error({
               message: "Ошибка Builder'а",
               error,
               moduleInfo
            });
         }
         callback();
      }
   );
};
