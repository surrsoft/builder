'use strict';

const path = require('path');
const fs = require('fs-extra');
const DepGraph = require('./dependencyGraph');

const MODULE_DEPENDENCIES_FILENAME = 'module-dependencies.json';

/**
 * @callback checkModuleDependenciesSanity~callback
 * @param {Error} [error]
 */

/**
 * Проверяем время создания module-dependencies.json. Оно должно быть больше времени создания contents.json.
 * Иначе мы рискуем получить уже неактульные данные.
 * @param {String} applicationRoot - путь до папки ресурсов
 * @param {checkModuleDependenciesSanity~callback} done - callback
 * @return {boolean}
 */
function checkModuleDependenciesSanity(applicationRoot, done) {
   let resourcesPath = path.join(applicationRoot, 'resources'),
      moduleDependenciesFile = path.join(resourcesPath, MODULE_DEPENDENCIES_FILENAME),
      contentsFile = path.join(resourcesPath, 'contents.json');

   if (!fs.existsSync(moduleDependenciesFile)) {
      done(new Error('No module dependencies file present. Please create with --collect-dependencies'));
      return false;
   }

   if (fs.existsSync(contentsFile) && fs.statSync(contentsFile).mtime > fs.statSync(moduleDependenciesFile).mtime) {
      done(new Error(MODULE_DEPENDENCIES_FILENAME + ' is outdated. Please recreate with --collect-dependencies'));
      return false;
   }

   return true;
}

/**
 * Получает путь до файла module-dependencies.json
 * @param {String} applicationRoot - путь до корня сервиса
 * @return {String}
 */
function getModuleDependenciesPath(applicationRoot) {
   return path.join(applicationRoot, 'resources', MODULE_DEPENDENCIES_FILENAME);
}

/**
 * Получение графа зависимостей
 * @param {String} applicationRoot
 * @return {DepGraph}
 */
function getDependencyGraphSync(applicationRoot) {
   const dg = new DepGraph();
   return dg.fromJSON(fs.readJsonSync(getModuleDependenciesPath(applicationRoot)));
}

async function getDependencyGraph(applicationRoot) {
   const dg = new DepGraph();
   return dg.fromJSON(await fs.readJson(getModuleDependenciesPath(applicationRoot)));
}

module.exports = {
   checkModuleDependenciesSanity: checkModuleDependenciesSanity,
   getModuleDependenciesPath: getModuleDependenciesPath,
   getDependencyGraphSync: getDependencyGraphSync,
   getDependencyGraph: getDependencyGraph
};
