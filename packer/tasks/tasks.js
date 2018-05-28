/* eslint-disable no-invalid-this */
'use strict';

const path = require('path');
const modDeps = require('./../lib/moduleDependencies');
const packHTML = require('./lib/packHTML');
const packOwnDeps = require('./lib/pack-own-deps');
const makeDependenciesGraph = require('./lib/collectDependencies');
const packCSS = require('./lib/packCSS').gruntPackCSS;
const packJS = require('./lib/packJS');
const logger = require('../../lib/logger').logger();

const isDemoModule = /ws\/lib\/Control\/\w+\/demo\//i;

/**
 * Сбор зависимостей модулей
 * @param grunt
 * @return {Function}
 */
function gruntCollectDependencies(grunt) {
   return function collectDependencies() {
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
   };
}

/**
 * Паковка модулей для статических html
 * @param grunt
 * @return {Function}
 */
function gruntPackModules(grunt) {
   return function packModules() {
      grunt.log.ok(`${grunt.template.today('hh:MM:ss')}: Запускается задача паковки зависимостей.`);

      const { root, application } = this.data,
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

      packHTML(grunt, dg, htmlFiles, this.data.packages, root, application, taskDone);
   };
}

/**
 * Паковка собственных зависимостей
 */
function gruntPackOwnDependencies() {
   return async function gruntPackOwnDependenciesTask() {
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
   };
}

function gruntPackCSS(grunt) {
   return function packCss() {
      logger.debug('Запускается задача паковки css.');

      const { root } = this.data,
         applicationRoot = path.join(root, this.data.application),
         htmlFiles = [];

      const sourceFiles = grunt.file.expand({ cwd: applicationRoot }, this.data.src);
      sourceFiles.forEach((pathToSource) => {
         htmlFiles.push(path.join(applicationRoot, pathToSource));
      });

      packCSS(htmlFiles, root, path.join(applicationRoot, this.data.packages));

      logger.debug('Задача паковки css выполнена.');
   };
}

function gruntPackJS(grunt) {
   return function packJs() {
      grunt.log.ok(`${grunt.template.today('hh:MM:ss')}: Запускается задача паковки js.`);

      const { root } = this.data,
         applicationRoot = path.join(root, this.data.application),
         htmlFiles = [];

      const sourceFiles = grunt.file.expand({ cwd: applicationRoot }, this.data.src);
      sourceFiles.forEach((pathToSource) => {
         htmlFiles.push(path.join(applicationRoot, pathToSource));
      });

      packJS(htmlFiles, root, path.join(applicationRoot, this.data.packages));

      grunt.log.ok(`${grunt.template.today('hh:MM:ss')}: Задача паковки js выполнена.`);
   };
}

module.exports = function registerTasks(grunt) {
   grunt.registerMultiTask('packwsmod', 'TODO', gruntPackModules(grunt));
   grunt.registerMultiTask('owndepspack', 'TODO', gruntPackOwnDependencies(grunt));
   grunt.registerMultiTask('collect-dependencies', 'TODO', gruntCollectDependencies(grunt));
   grunt.registerMultiTask('packcss', 'TODO', gruntPackCSS(grunt));
   grunt.registerMultiTask('packjs', 'TODO', gruntPackJS(grunt));
};
