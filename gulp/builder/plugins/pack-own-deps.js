/**
 * Плагин для паковки собственных зависимостей.
 * В js компоненты добавляется код собранных tmpl и xhtml из зависимостей.
 * Сильно влияет на плагин minify-js
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   helpers = require('../../../lib/helpers');

/**
 * Объявление плагина
 * @param {ChangesStore} changesStore кеш
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {stream}
 */
module.exports = function declarePlugin(changesStore, moduleInfo) {
   // js файлы можно паковать только после сборки xhtml и tmpl файлов.
   // поэтому переместим обработку в самый конец
   const jsFiles = [];
   return through.obj(
      function onTransform(file, encoding, callback) {
         if (file.extname !== '.js') {
            callback(null, file);
         } else {
            jsFiles.push(file);
            callback();
         }
      },

      /* @this Stream */
      function onFlush(callback) {
         try {
            const componentsInfo = changesStore.getComponentsInfo(moduleInfo.name);
            const markupCache = changesStore.getMarkupCache(moduleInfo.name);
            const nodenameToMarkup = new Map();
            for (const filePath of Object.keys(markupCache)) {
               const markupObj = markupCache[filePath];
               if (markupObj) {
                  nodenameToMarkup.set(markupObj.nodeName, {
                     text: markupObj.text,
                     filePath
                  });
               }
            }
            const getFullPathInSource = (dep) => {
               const moduleNameOutput = path.basename(moduleInfo.output);
               let relativeFileName = '';
               if (dep.startsWith('html!')) {
                  relativeFileName = `${relativeFileName.replace('html!', '')}.xhtml`;
               } else {
                  relativeFileName = `${relativeFileName.replace('tmpl!', '')}.tmpl`;
               }
               if (relativeFileName.startsWith(moduleNameOutput)) {
                  const relativeFileNameWoModule = relativeFileName
                     .split('/')
                     .slice(1)
                     .join('/');
                  return path.join(moduleInfo.path, relativeFileNameWoModule);
               }
               return '';
            };

            for (const jsFile of jsFiles) {
               // важно сохранить в зависимости для js все файлы, которые должны приводить к пересборке файла
               const filesDepsForCache = new Set();
               const ownDeps = [];
               const prettyFilePath = helpers.prettifyPath(jsFile.history[0]);
               if (componentsInfo.hasOwnProperty(prettyFilePath)) {
                  const componentInfo = componentsInfo[prettyFilePath];
                  if (componentInfo.componentName && componentInfo.componentDep) {
                     for (const dep of componentInfo.componentDep) {
                        if (dep.startsWith('html!') || dep.startsWith('tmpl!')) {
                           ownDeps.push(dep);
                           const fullPath = getFullPathInSource(dep);
                           if (fullPath) {
                              filesDepsForCache.add(fullPath);
                           }
                        }
                     }
                  }
               }
               if (ownDeps.length > 0) {
                  const modulepackContent = [];
                  for (const dep of ownDeps) {
                     if (nodenameToMarkup.has(dep)) {
                        const markupObj = nodenameToMarkup.get(dep);
                        filesDepsForCache.add(markupObj.filePath);
                        modulepackContent.push(markupObj.text);
                     }
                  }
                  if (modulepackContent.length > 0) {
                     modulepackContent.push(jsFile.contents.toString());
                     jsFile.modulepack = modulepackContent.join('\n');
                  }
               }
               if (filesDepsForCache.size > 0) {
                  changesStore.addDependencies(prettyFilePath, [...filesDepsForCache]);
               }
               this.push(jsFile);
            }
         } catch (error) {
            logger.error({
               message: "Ошибка Builder'а",
               error,
               moduleInfo
            });
         }
         callback(null);
      }
   );
};
