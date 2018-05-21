/* eslint-disable no-invalid-this */

'use strict';

const through = require('through2'),
   logger = require('../../../lib/logger').logger();

module.exports = function(changesStore, moduleInfo) {
   // js файлы можно паковать только после сборки xhtml и tmpl файлов.
   // поэтому переместим обработку в самый конец
   const jsFiles = [];
   return through.obj(
      function(file, encoding, callback) {
         if (file.extname !== '.js') {
            callback(null, file);
         } else {
            jsFiles.push(file);
            callback();
         }
      },
      function(callback) {
         try {
            const componentsInfo = changesStore.getComponentsInfo(moduleInfo.name);
            const markupCache = changesStore.getMarkupCache(moduleInfo.name);
            const nodenameToMarkup = new Map();
            for (const markupObj of Object.values(markupCache)) {
               nodenameToMarkup.set(markupObj.nodeName, markupObj.text);
            }

            for (const jsFile of jsFiles) {
               const ownDeps = [];
               if (componentsInfo.hasOwnProperty(jsFile.history[0])) {
                  const componentInfo = componentsInfo[jsFile.history[0]];
                  if (componentInfo.componentName && componentInfo.componentDep) {
                     for (const dep of componentInfo.componentDep) {
                        if (dep.startsWith('html!') || dep.startsWith('tmpl!')) {
                           ownDeps.push(dep);
                        }
                     }
                  }
               }
               if (ownDeps.length > 0) {
                  const modulepackContent = [];
                  for (const dep of ownDeps) {
                     if (nodenameToMarkup.has(dep)) {
                        modulepackContent.push(nodenameToMarkup.get(dep));
                     }
                  }
                  if (modulepackContent.length > 0) {
                     modulepackContent.push(jsFile.contents.toString());
                     jsFile.modulepack = modulepackContent.join('\n');
                  }
               }
               this.push(jsFile);
            }
         } catch (error) {
            logger.error({
               message: "Ошибка Builder'а",
               error: error,
               moduleInfo: moduleInfo
            });
         }
         callback(null);
      }
   );
};
