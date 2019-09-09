/**
 * Checks module's dependencies for existing in module-dependencies nodes and output directory
 * @author Колбешин Ф.А.
 */

'use strict';

const pluginsRegex = /!|\?/;
const fs = require('fs-extra');
const pMap = require('p-map');
const path = require('path');
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

function checkDependencyForExcludeRules(projectModulesNames, currentModuleLink, normalizedModuleName) {
   // ignore not existing dependency if optional plugin included
   if (currentModuleLink.includes('optional!')) {
      return true;
   }

   // i18n! modules don't have nodes in module-dependencies tree
   if (currentModuleLink.includes('i18n!')) {
      return true;
   }

   const currentLinkParts = normalizedModuleName.split('/');
   if (currentLinkParts.length === 1) {
      return true;
   }
   const currentLinkModuleName = currentLinkParts.shift();

   /**
    * ignore non-project dependencies(third-party libraries)
    * and dependencies from external interface modules
    */
   return !projectModulesNames.includes(currentLinkModuleName);
}

function getModuleInfoForCurrentNode(nodeName, modules) {
   const nodeNameWithoutPlugin = nodeName.split(pluginsRegex).pop();
   const normalizedNodeName = modulePathToRequire.normalizeModuleName(nodeNameWithoutPlugin);
   const currentModuleName = normalizedNodeName.split('/').shift();
   return modules.find(currentModuleInfo => path.basename(currentModuleInfo.path) === currentModuleName);
}

function getModuleNameWithPlugin(plugin, moduleName) {
   if (plugin) {
      return `${plugin}!${moduleName}`;
   }
   return moduleName;
}

async function isValidDependency(projectModulesNames, moduleDeps, currentModuleLink, outputDirectory) {
   const moduleNameWithoutPlugins = currentModuleLink.split(pluginsRegex).pop();
   const currentNodePlugin = getCurrentNodePlugin(currentModuleLink);
   const moduleNameWithPlugin = getModuleNameWithPlugin(currentNodePlugin, moduleNameWithoutPlugins);

   // check for existing node
   if (moduleDeps.nodes.hasOwnProperty(moduleNameWithPlugin)) {
      return true;
   }
   const normalizedNameWithoutPlugin = modulePathToRequire.normalizeModuleName(moduleNameWithoutPlugins);

   const ignoreDependencyByExcludeRules = checkDependencyForExcludeRules(
      projectModulesNames,
      currentModuleLink,
      helpers.removeLeadingSlashes(normalizedNameWithoutPlugin)
   );

   if (ignoreDependencyByExcludeRules) {
      return true;
   }

   let pathToCheck;

   // modules with text! plugin are already have extension
   if (currentNodePlugin === 'text') {
      pathToCheck = path.join(outputDirectory, normalizedNameWithoutPlugin);
   } else {
      pathToCheck = path.join(
         outputDirectory,
         `${normalizedNameWithoutPlugin}.${currentNodePlugin || 'js'}`
      );
   }
   const fileExistsInOutputDirectory = await fs.pathExists(pathToCheck);
   return fileExistsInOutputDirectory;
}

async function checkModuleDependenciesExisting(taskParameters) {
   const moduleDeps = taskParameters.cache.getModuleDependencies();
   const projectModulesNames = taskParameters.config.modules.map(
      moduleInfo => path.basename(moduleInfo.output)
   );
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
                  projectModulesNames,
                  moduleDeps,
                  currentModuleLink,
                  taskParameters.config.rawConfig.output
               );
               if (!validDependency) {
                  const message = `Error analizing dependencies: file for dependency "${currentModuleLink}" ` +
                     'doesn\'t exists in module-dependencies tree or into output directory.' +
                     'Check for dependency existing, or check that it\'s an optional! module';

                  /**
                   * Log error for SDK components with level ERROR,
                   * dependency existing for SDK components is very important.
                   */
                  if (moduleInfo.sdkElement) {
                     logger.error({
                        message,
                        moduleInfo,
                        filePath: analizingNodeName
                     });
                  } else {
                     logger.warning({
                        message,
                        moduleInfo,
                        filePath: analizingNodeName
                     });
                  }
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
   getCurrentNodePlugin,
   checkDependencyForExcludeRules,
   getModuleInfoForCurrentNode,
   isValidDependency,
   checkModuleDependenciesExisting
};
