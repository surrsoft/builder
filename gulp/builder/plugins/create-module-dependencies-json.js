/**
 * Плагин для создания module-dependencies.json (зависимости компонентов и их расположение. для runtime паковка)
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   helpers = require('../../../lib/helpers'),
   transliterate = require('../../../lib/transliterate');

// плагины, которые должны попасть в links
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
   'tmpl',
   'cdn',
   'preload',
   'remote'
]);

// стандартные модули, которые и так всегда есть
const excludeSystemModulesForLinks = new Set(['module', 'require', 'exports']);

// нужно добавить эти плагины, но сами зависимости добавлять в links не нужно
const pluginsOnlyDeps = new Set(['cdn', 'preload', 'remote']);

const parsePlugins = dep => [
   ...new Set(
      dep
         .split('!')
         .slice(0, -1)
         .map((depName) => {
            if (depName.includes('?')) {
               return depName.split('?')[1];
            }
            return depName;
         })
   )
];

const interfaceNamesMap = new Map([
   ['WS.Deprecated', 'Deprecated'],
   ['WS.Core/lib', 'Lib']
]);

/**
 * Объявление плагина
 * @param {ChangesStore} changesStore кеш
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @returns {*}
 */
module.exports = function declarePlugin(changesStore, moduleInfo) {
   return through.obj(
      function onTransform(file, encoding, callback) {
         callback(null, file);
      },

      /* @this Stream */
      function onFlush(callback) {
         try {
            const json = {
               links: {},
               nodes: {}
            };

            const filePathToRelativeInResources = (filePath) => {
               const ext = path.extname(filePath);
               const relativePath = path.relative(path.dirname(moduleInfo.path), filePath);
               const prettyPath = helpers.prettifyPath(path.join('resources', transliterate(relativePath)));
               return prettyPath.replace(ext, `.min${ext}`);
            };
            const getRequireName = (filePath) => {
               const pathParts = filePath.split('/');
               let filePathPart, requireName;

               pathParts.pop();
               while (pathParts.length !== 0 && !requireName) {
                  filePathPart = pathParts.join('/');
                  requireName = interfaceNamesMap.get(filePathPart);
                  pathParts.pop();
               }
               return requireName ? filePathPart : null;
            };
            const getPrettyFilePath = (filePath) => {
               const
                  requireNameToReplace = getRequireName(filePath);

               let resultPath = filePath;
               if (requireNameToReplace) {
                  resultPath = resultPath.replace(requireNameToReplace, interfaceNamesMap.get(requireNameToReplace));
               }
               return resultPath;
            };
            const componentsInfo = changesStore.getComponentsInfo(moduleInfo.name);
            Object.keys(componentsInfo).forEach((filePath) => {
               const info = componentsInfo[filePath];
               if (info.hasOwnProperty('componentName')) {
                  const depsOfLink = new Set();
                  if (info.hasOwnProperty('componentDep')) {
                     for (const dep of info.componentDep) {
                        let skipDep = false;
                        for (const plugin of parsePlugins(dep)) {
                           if (supportedPluginsForLinks.has(plugin)) {
                              depsOfLink.add(plugin);
                           }
                           if (pluginsOnlyDeps.has(plugin)) {
                              skipDep = true;
                           }
                        }
                        if (!excludeSystemModulesForLinks.has(dep) && !skipDep) {
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
               if (markupObj) {
                  if (markupObj.nodeName.startsWith('tmpl!')) {
                     json.links[markupObj.nodeName] = markupObj.dependencies || [];
                  }
                  json.nodes[markupObj.nodeName] = {
                     amd: true,
                     path: filePathToRelativeInResources(filePath)
                  };
               }
            }

            const cssFiles = changesStore
               .getInputPathsByFolder(moduleInfo.path)
               .filter(filePath => filePath.endsWith('.less') || filePath.endsWith('.css'))
               .map(filePath => filePath.replace('.less', '.css'));
            for (const filePath of cssFiles) {
               const relativePath = path.relative(path.dirname(moduleInfo.path), filePath);
               const prettyPath = getPrettyFilePath(helpers.prettifyPath(transliterate(relativePath)));
               const nodeName = `css!${prettyPath.replace('.css', '')}`;
               json.nodes[nodeName] = {
                  path: filePathToRelativeInResources(filePath)
               };
            }

            const jsonFile = new Vinyl({
               path: 'module-dependencies.json',
               contents: Buffer.from(JSON.stringify(helpers.sortObject(json), null, 2)),
               moduleInfo
            });
            this.push(jsonFile);

            changesStore.storeLocalModuleDependencies(json);
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
