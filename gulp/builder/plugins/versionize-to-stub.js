/**
 * Плагин для версионирования в процессе инкрементальной сборки. В места, где должна быть версия, добавляет заглушку.
 * Связан с versionize-finish
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   logger = require('../../../lib/logger').logger();

const VERSION_STUB = '.vBUILDER_VERSION_STUB';

const includeExts = ['.css', '.js', '.html', '.tmpl', '.xhtml'];

/**
 * Объявление плагина
 * @param {TaskParameters} taskParameters параметры для задач
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {stream}
 */
module.exports = function declarePlugin(taskParameters, moduleInfo) {
   return through.obj(function onTransform(file, encoding, callback) {
      try {
         if (!includeExts.includes(file.extname)) {
            callback(null, file);
            return;
         }

         if (file.cached) {
            callback(null, file);
            return;
         }

         let newText = file.contents.toString();

         if (file.extname === '.css') {
            newText = newText.replace(
               /(url\(['"]?)([\w/.\-@{}]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg|\.css|\.woff|\.eot|\.ttf)/g,
               (match, partUrl, partFilePath, partExt) => {
                  if (partFilePath.indexOf('cdn/') > -1) {
                     return match;
                  }
                  return partUrl + partFilePath + VERSION_STUB + partExt;
               }
            );
         } else if (file.extname === '.js') {
            newText = newText.replace(
               /((?:"|')(?:[A-z]+(?!:\/)|\/|\.\/|ws:\/)[\w/+-.]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg)/g,
               `$1${VERSION_STUB}$2`
            );
         } else if (['.html', '.tmpl', '.xhtml'].includes(file.extname)) {
            newText = newText
               .replace(
                  /((?:"|')(?:[A-z]+(?!:\/)|\/|\.\/|%[^}]+}|{{[^}]+}})[\w/+-.]+(?:\.\d+)?)(\.svg|\.css|\.gif|\.png|\.jpg|\.jpeg)/gi,
                  (match, partFilePath, partExt) => {
                     if (partExt === '.css') {
                        // если в пути уже есть .min, то дублировать не нужно
                        const partFilePathWithoutMin = partFilePath.replace(/\.min$/, '');
                        return `${partFilePathWithoutMin}.min${VERSION_STUB + partExt}`;
                     }
                     return partFilePath + VERSION_STUB + partExt;
                  }
               )
               .replace(
                  /([\w]+[\s]*=[\s]*)((?:"|')(?:[A-z]+(?!:\/)|\/|(?:\.|\.\.)\/|%[^}]+})[\w/+-.]+(?:\.\d+)?)(\.js)/gi,
                  (match, partEqual, partFilePath, partExt) => {
                     // ignore cdn and data-providers
                     if (
                        partFilePath.indexOf('cdn/') > -1 ||
                        partFilePath.indexOf('//') === 1 ||
                        !/^src|^href/i.test(match) ||
                        partFilePath.indexOf(VERSION_STUB) > -1
                     ) {
                        return match;
                     }

                     // если в пути уже есть .min, то дублировать не нужно
                     const partFilePathWithoutMin = partFilePath.replace(/\.min$/, '');
                     return `${partEqual + partFilePathWithoutMin}.min${VERSION_STUB + partExt}`;
                  }
               );
         }

         file.contents = Buffer.from(newText);
      } catch (error) {
         taskParameters.cache.markFileAsFailed(file.history[0]);
         logger.error({
            message: "Ошибка builder'а при версионировании",
            error,
            moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
