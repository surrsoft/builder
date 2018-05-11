/* eslint-disable no-unlimited-disable*/
/* eslint-disable */
'use strict';

const async = require('async');
const path = require('path');
const modDeps = require('./../lib/moduleDependencies');
const packHTML = require('./lib/packHTML');
const packOwnDeps = require('./lib/packOwnDeps');
const makeDependenciesGraph = require('./lib/collectDependencies');
const packCSS = require('./lib/packCSS').gruntPackCSS;
const packJS = require('./lib/packJS');
const logger = require('../../lib/logger').logger();

const isDemoModule = /ws\/lib\/Control\/\w+\/demo\//i;
const badConfigs = [];

/**
 * Сбор зависимостей модулей
 * @param grunt
 * @return {Function}
 */
function gruntCollectDependencies(grunt) {
   return function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача сбора зависимостей.');

      let root = this.data.root,
         application = this.data.application,
         applicationRoot = path.join(root, application),
         taskDone = this.async(),
         jsFiles = [];

      const sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);
      sourceFiles.sort();
      sourceFiles
         .filter(function isDemo(pathToSource) {
            return !isDemoModule.test(pathToSource);
         })
         .forEach(function(pathToSource) {
            jsFiles.push(path.join(applicationRoot, pathToSource));
         });

      makeDependenciesGraph(grunt, root, applicationRoot, jsFiles, function(err, jsonGraph) {
         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача сбора зависимостей выполнена.');
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
   return function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача паковки зависимостей.');

      let root = this.data.root,
         application = this.data.application,
         applicationRoot = path.join(root, application),
         done = this.async(),
         htmlFiles = [],
         taskDone, dg;

      taskDone = function() {
         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача паковки зависимостей выполнена.');
         done();
      };

      if (!modDeps.checkModuleDependenciesSanity(applicationRoot, taskDone)) {
         return;
      }

      dg = modDeps.getDependencyGraph(applicationRoot);

      const sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);
      sourceFiles.forEach(function(pathToSource) {
         htmlFiles.push(path.join(applicationRoot, pathToSource));
      });

      packHTML(grunt, dg, htmlFiles, this.data.packages, root, application, taskDone);
   };
}

/**
 * Паковка собственных зависимостей
 * @param grunt
 * @return {gruntPackOwnDependencies}
 */
function gruntPackOwnDependencies(grunt) {
   return function gruntPackOwnDependencies() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача паковки собственных зависимостей.');

      let root = this.data.root,
         applicationRoot = path.join(root, this.data.application),
         done = this.async(),
         taskDone, dg;

      const dryRun = grunt.option('dry-run');
      if (dryRun) {
         grunt.log.writeln('Doing dry run!');
      }

      taskDone = function() {
         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача паковки собственных зависимостей выполнена.');
         done();
      };

      if (!modDeps.checkModuleDependenciesSanity(applicationRoot, taskDone)) {
         return;
      }

      dg = modDeps.getDependencyGraph(applicationRoot);

      // Передаем root, чтобы относительно него изменялись исходники в loaders
      packOwnDeps(dryRun, dg, root, applicationRoot, this.data.splittedCore, taskDone);
   };
}

function saveBundlesForEachModule(grunt, applicationRoot) {
   Object.keys(bundlesOptions.bundles).forEach(function(currentBundle) {
      let
         bundlePath = path.normalize(path.join(applicationRoot, `${currentBundle.match(/^resources\/[^/]+/)}`, 'bundlesRoute.json')),
         currentModules = bundlesOptions.bundles[currentBundle],
         bundleRouteToWrite = grunt.file.exists(bundlePath) ? JSON.parse(grunt.file.read(bundlePath)) : {};

      currentModules.forEach(function(node) {
         if (node.indexOf('css!') === -1) {
            bundleRouteToWrite[node] = currentBundle;
         }
      });
      grunt.file.write(bundlePath, JSON.stringify(bundleRouteToWrite));
   });
}

function getNameSpaces(intersects) {
   let
      namespaces = {},
      currentNamespace,
      nameWithoutSlash;
   intersects.forEach(function(moduleName) {
      nameWithoutSlash = moduleName.split(/\?|!/).pop().split('/')[0].split('.');
      if (nameWithoutSlash.length > 2) {
         currentNamespace = [nameWithoutSlash[0], nameWithoutSlash[1]].join('.');
      } else {
         currentNamespace = nameWithoutSlash.join('.');
      }
      namespaces[currentNamespace] = 1;
   });
   return Object.keys(namespaces);

}

function gruntPackCSS(grunt) {
   return function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача паковки css.');

      let root = this.data.root,
         applicationRoot = path.join(root, this.data.application),
         htmlFiles = [];

      const sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);
      sourceFiles.forEach(function(pathToSource) {
         htmlFiles.push(path.join(applicationRoot, pathToSource));
      });

      packCSS(htmlFiles, root, path.join(applicationRoot, this.data.packages));

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача паковки css выполнена.');
   };
}

function gruntPackJS(grunt) {
   return function() {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача паковки js.');

      let root = this.data.root,
         applicationRoot = path.join(root, this.data.application),
         htmlFiles = [];

      const sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);
      sourceFiles.forEach(function(pathToSource) {
         htmlFiles.push(path.join(applicationRoot, pathToSource));
      });

      packJS(htmlFiles, root, path.join(applicationRoot, this.data.packages));

      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача паковки js выполнена.');
   };
}

module.exports = function(grunt) {
   grunt.registerMultiTask('packwsmod', 'TODO', gruntPackModules(grunt));
   grunt.registerMultiTask('owndepspack', 'TODO', gruntPackOwnDependencies(grunt));
   grunt.registerMultiTask('collect-dependencies', 'TODO', gruntCollectDependencies(grunt));
   grunt.registerMultiTask('packcss', 'TODO', gruntPackCSS(grunt));
   grunt.registerMultiTask('packjs', 'TODO', gruntPackJS(grunt));
};
