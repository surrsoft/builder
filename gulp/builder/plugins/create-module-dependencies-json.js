/* eslint-disable no-invalid-this */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   helpers = require('../../../lib/helpers'),
   transliterate = require('../../../lib/transliterate');

//плагины, которые должны попасть в links
const supportedPluginsForLinks = new Set([
   'is',
   'html',
   'css',
   'json',
   'xml',
   'text',
   'native-css',
   'browser',
   'optional',
   'i18n',
   'tmpl'
]);
const excludeSystemModulesForLinks = new Set(['module', 'require', 'exports']);

const parsePlugins = dep => {
   return [
      ...new Set(
         dep
            .split('!')
            .slice(0, -1)
            .map(depName => {
               if (depName.includes('?')) {
                  return depName.split('?')[1];
               }
               return depName;
            })
      )
   ];
};
module.exports = function(changesStore, moduleInfo) {
   return through.obj(
      function(file, encoding, callback) {
         callback(null, file);
      },
      function(callback) {
         try {
            const json = {
               links: {},
               nodes: {}
            };

            const filePathToRelativeInResources = filePath => {
               const ext = path.extname(filePath);
               const relativePath = path.relative(path.dirname(moduleInfo.path), filePath);
               const prettyPath = helpers.prettifyPath(path.join('resources', transliterate(relativePath)));
               return prettyPath.replace(ext, '.min' + ext);
            };
            const componentsInfo = changesStore.getComponentsInfo(moduleInfo.name);
            Object.keys(componentsInfo).forEach(filePath => {
               const info = componentsInfo[filePath];
               if (info.hasOwnProperty('componentName')) {
                  const depsOfLink = new Set();
                  if (info.hasOwnProperty('componentDep')) {
                     for (const dep of info.componentDep) {
                        for (const plugin of parsePlugins(dep)) {
                           if (supportedPluginsForLinks.has(plugin)) {
                              depsOfLink.add(plugin);
                           }
                        }
                        if (!excludeSystemModulesForLinks.has(dep)) {
                           depsOfLink.add(dep);
                        }
                     }
                  }
                  json.links[info.componentName] = [...depsOfLink];
                  json.nodes[info.componentName] = {
                     amd: true,
                     path: filePathToRelativeInResources(filePath)
                  };
               }
            });

            const markupCache = changesStore.getMarkupCache(moduleInfo.name);
            for (const filePath of Object.keys(markupCache)) {
               const markupObj = markupCache[filePath];
               if (markupObj.nodeName.startsWith('tmpl!')) {
                  json.links[markupObj.nodeName] = markupObj.dependencies || [];
               }
               json.nodes[markupObj.nodeName] = {
                  amd: true,
                  path: filePathToRelativeInResources(filePath)
               };
            }

            const cssFiles = changesStore
               .getInputPathsByFolder(moduleInfo.path)
               .filter(filePath => filePath.endsWith('.less') || filePath.endsWith('.css'))
               .map(filePath => filePath.replace('.less', '.css'));
            for (const filePath of cssFiles) {
               const relativePath = path.relative(path.dirname(moduleInfo.path), filePath);
               const prettyPath = helpers.prettifyPath(transliterate(relativePath));
               const nodeName = 'css!' + prettyPath.replace('.css', '');
               json.nodes[nodeName] = {
                  path: filePathToRelativeInResources(filePath)
               };
            }

            const jsonFile = new Vinyl({
               path: 'module-dependencies.json',
               contents: Buffer.from(JSON.stringify(helpers.sortObject(json), null, 2)),
               moduleInfo: moduleInfo
            });
            this.push(jsonFile);
         } catch (error) {
            logger.error({
               message: 'Ошибка Builder\'а',
               error: error,
               moduleInfo: moduleInfo
            });
         }
         callback();
      }
   );
};
