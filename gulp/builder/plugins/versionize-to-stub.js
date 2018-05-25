'use strict';

const through = require('through2'),
   logger = require('../../../lib/logger').logger();

const VERSION_STUB = '.vBUILDER_VERSION_STUB';

const includeExts = ['.css', '.js', '.html', '.tmpl', '.xhtml'];

module.exports = function declarePlugin(config, changesStore, moduleInfo) {
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
               /(url\(['"]?)([\w/.\-@{}]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg|\.css|\.woff|\.eot)/g,
               (match, partUrl, partFilePath, partExt) => {
                  if (partFilePath.indexOf('cdn/') > -1) {
                     return match;
                  }
                  return partUrl + partFilePath + VERSION_STUB + partExt;
               }
            );
         } else if (file.extname === '.js') {
            newText = newText.replace(
               /((?:"|')(?:[a-z]+(?!:\/)|\/|\.\/|ws:\/)[\w/+-.]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg)/g,
               `$1${VERSION_STUB}$2`
            );
         } else if (['.html', '.tmpl', '.xhtml'].includes(file.extname)) {
            newText = newText
               .replace(
                  /((?:"|')(?:[a-z]+(?!:\/)|\/|\.\/|%[^}]+}|{{[^}}]+}})[\w/+-.]+(?:\.\d+)?)(\.svg|\.css|\.gif|\.png|\.jpg|\.jpeg)/gi,
                  `$1${VERSION_STUB}$2`
               )
               .replace(
                  /([\w]+[\s]*=[\s]*)((?:"|')(?:[a-z]+(?!:\/)|\/|(?:\.|\.\.)\/|%[^}]+})[\w/+-.]+(?:\.\d+)?)(\.js)/gi,
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
                     return partEqual + partFilePath + VERSION_STUB + partExt;
                  }
               );
         }

         file.contents = Buffer.from(newText);
      } catch (error) {
         changesStore.markFileAsFailed(file.history[0]);
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
