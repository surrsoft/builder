/**
 * Checks module's dependencies for existing in module-dependencies nodes and output directory
 * @author Колбешин Ф.А.
 */

'use strict';

const pluginsRegex = /!|\?/;
const fs = require('fs-extra');
const pMap = require('p-map');
const path = require('path');
const excludeModuleNames = [
   'require',
   'exports',
   'jquery',
   'tslib',
   'router'
];
const requirejsPlugins = [
   'wml',
   'tmpl',
   'html',
   'xhtml',
   'css',
   'jstpl',
   'json',
   'text'
];

const logger = require('./logger').logger();
const helpers = require('./helpers');
const modulePathToRequire = require('./modulepath-to-require');

function getCurrentNodePlugin(fullName) {
   let result = '';
   requirejsPlugins.forEach((currentPlugin) => {
      if (fullName.includes(`${currentPlugin}!`)) {
         result = currentPlugin;
      }
   });
   return result;
}

function checkDependencyForExcludeRules(currentModuleLink, moduleNameWithoutPlugins) {
   // ignore not existing dependency if optional plugin included
   if (currentModuleLink.includes('optional!')) {
      return true;
   }

   // i18n! modules don't have nodes in module-dependencies tree
   if (currentModuleLink.includes('i18n!')) {
      return true;
   }

   // check dependency for excluded names.
   return excludeModuleNames.includes(moduleNameWithoutPlugins);
}

function getModuleInfoForCurrentNode(nodeName, modules) {
   const nodeNameWithoutPlugin = nodeName.split(pluginsRegex).pop();
   const currentModuleName = nodeNameWithoutPlugin.split('/').shift();
   return modules.find(currentModuleInfo => path.basename(currentModuleInfo.path) === currentModuleName);
}

async function isValidDependency(moduleDeps, currentModuleLink, outputDirectory) {
   const moduleNameWithoutPlugins = currentModuleLink.split(pluginsRegex).pop();
   const currentNodePlugin = getCurrentNodePlugin(currentModuleLink);
   let normalizedModuleName;
   if (currentNodePlugin) {
      normalizedModuleName = `${currentNodePlugin}!${moduleNameWithoutPlugins}`;
   } else {
      normalizedModuleName = moduleNameWithoutPlugins;
   }

   // check for existing node
   if (moduleDeps.nodes.hasOwnProperty(normalizedModuleName)) {
      return true;
   }

   const ignoreDependencyByExcludeRules = checkDependencyForExcludeRules(
      currentModuleLink,
      helpers.removeLeadingSlash(moduleNameWithoutPlugins)
   );

   if (ignoreDependencyByExcludeRules) {
      return true;
   }


   normalizedModuleName = modulePathToRequire.normalizeModuleName(moduleNameWithoutPlugins);
   const fileExistsInOutputDirectory = await fs.pathExists(
      path.join(
         outputDirectory,
         `${normalizedModuleName}.${currentNodePlugin || 'js'}`
      )
   );
   return fileExistsInOutputDirectory;
}

async function checkModuleDependenciesExisting(taskParameters) {
   const moduleDeps = taskParameters.cache.getModuleDependencies();
   await pMap(
      Object.entries(moduleDeps.links),
      async(currentEntry) => {
         const [analizingNodeName, currentNodeLinks] = currentEntry;
         const moduleInfo = getModuleInfoForCurrentNode(analizingNodeName, taskParameters.config.modules);

         // moduleInfo is undefined for third-party libraries and Core nodes, such as Deprecated, Lib, etc.
         if (!moduleInfo) {
            return;
         }
         await pMap(
            currentNodeLinks,
            async(currentModuleLink) => {
               const validDependency = await isValidDependency(
                  moduleDeps,
                  currentModuleLink,
                  taskParameters.config.rawConfig.output
               );
               if (!validDependency) {
                  const message = `Error analizing dependencies: file for dependency "${currentModuleLink}" ` +
                     'doesn\'t exists in module-dependencies tree or into output directory.' +
                     'Check for dependency existing, or check that it\'s an optional! module';
                  logger.warning({
                     message,
                     moduleInfo,
                     filePath: analizingNodeName
                  });
               }
            },
            {
               concurrency: 50
            }
         );
      },
      {
         concurrency: 50
      }
   );
}

module.exports = {
   excludeModuleNames,
   getCurrentNodePlugin,
   checkDependencyForExcludeRules,
   getModuleInfoForCurrentNode,
   isValidDependency,
   checkModuleDependenciesExisting
};
