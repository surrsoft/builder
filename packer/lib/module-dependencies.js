'use strict';

const path = require('path');
const fs = require('fs-extra');
const DepGraph = require('./dependency-graph');
const pMap = require('p-map');
const MODULE_DEPENDENCIES_FILENAME = 'module-dependencies.json';

/**
 * Получает путь до файла module-dependencies.json
 * @param {String} applicationRoot - путь до корня сервиса
 * @return {String}
 */
function getModuleDependenciesPath(applicationRoot) {
   return path.join(applicationRoot, 'resources', MODULE_DEPENDENCIES_FILENAME);
}

/**
 * Получаем список интерфейсных модулей для дальнейшего
 * чтения помодульных module-dependencies
 */
async function getDirectoriesList(source) {
   const directories = [],
      sourceList = await fs.readdir(source);

   await pMap(
      sourceList,
      async(element) => {
         const elementStats = await fs.lstat(path.join(source, element));
         if (elementStats.isDirectory()) {
            directories.push(element);
         }
      },
      {
         concurrency: 10
      }
   );
   return directories;
}

/**
 * Собираем общий module-dependencies из помодульных
 * и сохраняем его.
 */
async function createModuleDepsFromParts(resourcePath) {
   const interfaceModules = await getDirectoriesList(resourcePath),
      mDeps = {
         nodes: {},
         links: {}
      };

   await pMap(interfaceModules, async(currentDir) => {
      const moduleMDepsPath = path.join(resourcePath, currentDir, 'module-dependencies.json');
      let moduleMDeps;
      if (await fs.pathExists(moduleMDepsPath)) {
         moduleMDeps = await fs.readJson(moduleMDepsPath);
         Object.keys(moduleMDeps.nodes).forEach((node) => {
            mDeps.nodes[node] = moduleMDeps.nodes[node];
         });
         Object.keys(moduleMDeps.links).forEach((node) => {
            mDeps.links[node] = moduleMDeps.links[node];
         });
      }
   });

   await fs.writeJson(path.join(resourcePath, 'module-dependencies.json'), mDeps);
   return mDeps;
}

async function getDependencyGraph(applicationRoot) {
   const dg = new DepGraph(),
      depsTreePath = getModuleDependenciesPath(applicationRoot);

   if (!(await fs.pathExists(depsTreePath))) {
      const result = await createModuleDepsFromParts(path.join(applicationRoot, 'resources'));
      return dg.fromJSON(result);
   }
   return dg.fromJSON(await fs.readJson(depsTreePath));
}

module.exports = {
   getModuleDependenciesPath,
   getDependencyGraph
};
