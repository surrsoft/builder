/* eslint-disable no-invalid-this */
'use strict';

const path = require('path');
const modDeps = require('./../lib/moduleDependencies');
const { gruntPackHTML } = require('./lib/packHTML');
const packOwnDeps = require('./lib/pack-own-deps');
const makeDependenciesGraph = require('./lib/collectDependencies');
const { gruntPackCSS } = require('./lib/packCSS');
const packJS = require('./lib/packJS').gruntPackJS;
const logger = require('../../lib/logger').logger();

const isDemoModule = /ws\/lib\/Control\/\w+\/demo\//i;

/**
 * Сбор зависимостей модулей
 * @param grunt
 * @return {Function}
 */
function gruntCollectDependenciesTask(grunt) {
   return function collectDependencies() {
      try {
         grunt.log.ok(`${grunt.template.today('hh:MM:ss')}: Запускается задача сбора зависимостей.`);

         const { root, application } = this.data,
            applicationRoot = path.join(root, application),
            taskDone = this.async(),
            jsFiles = [];

         const sourceFiles = grunt.file.expand({ cwd: applicationRoot }, this.data.src);
         sourceFiles.sort();
         sourceFiles
            .filter(function isDemo(pathToSource) {
               return !isDemoModule.test(pathToSource);
            })
            .forEach((pathToSource) => {
               jsFiles.push(path.join(applicationRoot, pathToSource));
            });

         makeDependenciesGraph(grunt, root, applicationRoot, jsFiles, (err, jsonGraph) => {
            grunt.log.ok(`${grunt.template.today('hh:MM:ss')}: Задача сбора зависимостей выполнена.`);
            if (err) {
               taskDone(err);
            } else {
               grunt.file.write(modDeps.getModuleDependenciesPath(applicationRoot), jsonGraph);
               taskDone();
            }
         });
      } catch (error) {
         logger.error({ error });
      }
   };
}

/**
 * Паковка модулей для статических html
 * @param grunt
 * @return {Function}
 */
function gruntPackModulesTask(grunt) {
   return async function packModules() {
      try {
         grunt.log.ok(`${grunt.template.today('hh:MM:ss')}: Запускается задача паковки зависимостей.`);

         const { root, application } = this.data,
            coreConstants = global.requirejs('Core/constants'),
            applicationRoot = path.join(root, application),
            done = this.async(),
            htmlFiles = [];

         const taskDone = function() {
            grunt.log.ok(`${grunt.template.today('hh:MM:ss')}: Задача паковки зависимостей выполнена.`);
            done();
         };

         if (!modDeps.checkModuleDependenciesSanity(applicationRoot, taskDone)) {
            return;
         }

         const dg = modDeps.getDependencyGraphSync(applicationRoot);

         const sourceFiles = grunt.file.expand({ cwd: applicationRoot }, this.data.src);
         sourceFiles.forEach((pathToSource) => {
            htmlFiles.push(path.join(applicationRoot, pathToSource));
         });

         await gruntPackHTML(
            grunt,
            dg,
            htmlFiles,
            this.data.packages,
            root,
            application,
            Object.keys(coreConstants.availableLanguage)
         );
         taskDone();
      } catch (error) {
         logger.error({ error });
      }
   };
}

/**
 * Паковка собственных зависимостей
 */
function gruntPackOwnDependenciesTask() {
   return async function gruntPackOwnDependencies() {
      try {
         logger.debug('Запускается задача паковки собственных зависимостей.');

         const { root } = this.data,
            applicationRoot = path.join(root, this.data.application),
            done = this.async();

         if (!modDeps.checkModuleDependenciesSanity(applicationRoot, done)) {
            return;
         }

         const dg = modDeps.getDependencyGraphSync(applicationRoot);

         // Передаем root, чтобы относительно него изменялись исходники в loaders
         await packOwnDeps(dg, root, applicationRoot, this.data.splittedCore);

         logger.debug('Задача паковки собственных зависимостей выполнена.');
         done();
      } catch (error) {
         logger.error({ error });
      }
   };
}

function gruntPackCSSTask(grunt) {
   return async function packCss() {
      try {
         logger.debug('Запускается задача паковки css.');

         const { root } = this.data,
            done = this.async(),
            applicationRoot = path.join(root, this.data.application),
            htmlFiles = [],
            buildNumber = grunt.option('versionize');

         const sourceFiles = grunt.file.expand({ cwd: applicationRoot }, this.data.src);
         sourceFiles.forEach((pathToSource) => {
            htmlFiles.push(path.join(applicationRoot, pathToSource));
         });

         await gruntPackCSS(htmlFiles, root, path.join(applicationRoot, this.data.packages), buildNumber);

         logger.debug('Задача паковки css выполнена.');
         done();
      } catch (error) {
         logger.error({ error });
      }
   };
}

function gruntPackJSTask(grunt) {
   return async function packJs() {
      try {
         grunt.log.ok(`${grunt.template.today('hh:MM:ss')}: Запускается задача паковки js.`);

         const { root } = this.data,
            done = this.async(),
            applicationRoot = path.join(root, this.data.application),
            htmlFiles = [],
            buildNumber = grunt.option('versionize');

         const sourceFiles = grunt.file.expand({ cwd: applicationRoot }, this.data.src);
         sourceFiles.forEach((pathToSource) => {
            htmlFiles.push(path.join(applicationRoot, pathToSource));
         });

         await packJS(htmlFiles, root, path.join(applicationRoot, this.data.packages), buildNumber);

         grunt.log.ok(`${grunt.template.today('hh:MM:ss')}: Задача паковки js выполнена.`);
         done();
      } catch (error) {
         logger.error({ error });
      }
   };
}

module.exports = function registerTasks(grunt) {
   grunt.registerMultiTask('packwsmod', 'TODO', gruntPackModulesTask(grunt));
   grunt.registerMultiTask('owndepspack', 'TODO', gruntPackOwnDependenciesTask(grunt));
   grunt.registerMultiTask('collect-dependencies', 'TODO', gruntCollectDependenciesTask(grunt));
   grunt.registerMultiTask('packcss', 'TODO', gruntPackCSSTask(grunt));
   grunt.registerMultiTask('packjs', 'TODO', gruntPackJSTask(grunt));
};
