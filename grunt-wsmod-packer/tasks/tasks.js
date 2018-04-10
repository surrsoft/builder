// Инициализация ws в текущем application
require('./../lib/node-ws')();
var async = require('async');
var path = require('path');
var fs = require('fs');
var modDeps = require('./../lib/moduleDependencies');
var deanonymizer = require('./lib/deanonymizer');
var packHTML = require('./lib/packHTML');
var packOwnDeps = require('./lib/packOwnDeps');
var customPackage = require('./lib/customPackage');
var makeDependenciesGraph = require('./lib/collectDependencies');
var packCSS = require('./lib/packCSS').gruntPackCSS;
var packJS = require('./lib/packJS');
var prepackJs = require('./lib/prepackjs');

var isDemoModule = /ws\/lib\/Control\/\w+\/demo\//i;
var jsExtReg = /\.js$/;
var badConfigs = [];
var bundlesOptions = {
    bundles: {},
    modulesInBundles: {},
    intersects: {},
    outputs: {}
};

/**
 * Деанонимизация модулей
 * @param grunt
 * @return {Function}
 */
function gruntDeanonymizeDefine(grunt) {
    return function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача деанонимизации модулей.');

        var root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application),
            taskDone = this.async(),
            jsFiles = [];

        if (this.data.src) {
            var sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);

            sourceFiles.forEach(function (pathToSource) {
                jsFiles.push(path.join(applicationRoot, pathToSource));
            });
        }

        deanonymizer(grunt, jsFiles, root, function () {
            grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача деанонимизации модулей выполнена.');
            taskDone();
        });
    }
}

/**
 * Сбор зависимостей модулей
 * @param grunt
 * @return {Function}
 */
function gruntCollectDependencies(grunt) {
    return function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача сбора зависимостей.');

        var root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application),
            taskDone = this.async(),
            jsFiles = [];

        var sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);
        sourceFiles.sort();
        sourceFiles
            .filter(function isDemo(pathToSource) {
                return !isDemoModule.test(pathToSource);
            })
            .forEach(function (pathToSource) {
                jsFiles.push(path.join(applicationRoot, pathToSource));
            });

        makeDependenciesGraph(grunt, root, applicationRoot, jsFiles, function (err, jsonGraph) {
            grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача сбора зависимостей выполнена.');
            if (err) {
                taskDone(err);
            } else {
                grunt.file.write(modDeps.getModuleDependenciesPath(applicationRoot), jsonGraph);
                taskDone();
            }
        });
    }
}

/**
 * Паковка модулей для статических html
 * @param grunt
 * @return {Function}
 */
function gruntPackModules(grunt) {
    return function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача паковки зависимостей.');

        var root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application),
            done = this.async(),
            htmlFiles = [],
            taskDone, dg;

        taskDone = function () {
            grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача паковки зависимостей выполнена.');
            done();
        };

        if (!modDeps.checkModuleDependenciesSanity(applicationRoot, taskDone)) {
            return;
        }

        dg = modDeps.getDependencyGraph(applicationRoot);

        var sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);
        sourceFiles.forEach(function (pathToSource) {
            htmlFiles.push(path.join(applicationRoot, pathToSource));
        });

        packHTML(grunt, dg, htmlFiles, this.data.packages, root, application, taskDone);
    }
}

/**
 * Паковка собственных зависимостей
 * @param grunt
 * @return {gruntPackOwnDependencies}
 */
function gruntPackOwnDependencies(grunt) {
    return function gruntPackOwnDependencies() {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача паковки собственных зависимостей.');

        var root = this.data.root,
            applicationRoot = path.join(root, this.data.application),
            done = this.async(),
            taskDone, dg;

        var dryRun = grunt.option('dry-run');
        if (dryRun) {
            grunt.log.writeln('Doing dry run!');
        }

        taskDone = function () {
            grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача паковки собственных зависимостей выполнена.');
            done();
        };

        if (!modDeps.checkModuleDependenciesSanity(applicationRoot, taskDone)) {
            return;
        }

        dg = modDeps.getDependencyGraph(applicationRoot);

        // Передаем root, чтобы относительно него изменялись исходники в loaders
        packOwnDeps(dryRun, dg, root, applicationRoot, this.data.splittedCore, taskDone);
    }
}

function saveBundlesForEachModule(grunt, applicationRoot) {
    Object.keys(bundlesOptions.bundles).forEach(function(currentBundle) {
        var
            bundlePath = path.normalize(path.join(applicationRoot, `${currentBundle.match(/^resources\/[^/]+/)}`, 'bundlesRoute.json')),
            currentModules = bundlesOptions.bundles[currentBundle],
            bundleRouteToWrite = grunt.file.exists(bundlePath) ? JSON.parse(grunt.file.read(bundlePath)): {};

        currentModules.forEach(function(node) {
            if (node.indexOf('css!') === -1) {
                bundleRouteToWrite[node] = currentBundle;
            }
        });
        grunt.file.write(bundlePath, JSON.stringify(bundleRouteToWrite));
    });
}

function getNameSpaces(intersects) {
    var
        namespaces = {},
        currentNamespace,
        nameWithoutSlash;
    intersects.forEach(function(moduleName){
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

/**
 * Пользовательская паковка
 * @param grunt
 * @return {Function}
 */
function gruntCustomPack(grunt) {
    return function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача создания кастомных пакетов.');

        var
            root = this.data.root,
            applicationRoot = path.join(root, this.data.application),
            configsFiles = [],
            done = this.async(),
            dblSlashes = /\\/g,
            bundlesPath = 'ext/requirejs',
            wsRoot = grunt.file.exists(applicationRoot, 'resources/WS.Core') ? 'resources/WS.Core' : 'ws',
            bundlesRoutePath,
            taskDone, dg, configsArray, generateIntersectsConfig, collectDepsAndIntersectsDone,
            deleteIntersectsFromPackages, startCreateCustomPacks;

        generateIntersectsConfig = function() {
            var
                namespacesForConfigs = {},
                intersects = Object.keys(bundlesOptions.intersects),
                configPath = '';

            //Генерим для неймспейсов orderQueue и создаём для них конфигурации для кастомной паковки
            getNameSpaces(intersects).forEach(function(namespace) {
                var modulesWithCurrentNamespace = intersects.filter(function(module) {
                    var regexp = new RegExp(`^${namespace}|^js!${namespace}`);
                    return regexp.test(module);
                });
                namespacesForConfigs[namespace] = [];
                for (var i = 0; i < modulesWithCurrentNamespace.length; i++) {
                    namespacesForConfigs[namespace].push(bundlesOptions.intersects[modulesWithCurrentNamespace[i]]);
                }
                var
                    moduleRoot = namespacesForConfigs[namespace][0].fullPath.replace(applicationRoot, '').split('/');
                moduleRoot = moduleRoot.length > 2 ? path.join(moduleRoot[0], moduleRoot[1]) : moduleRoot[0];
                configPath = path.join(moduleRoot, namespace.replace('.', '-').toLowerCase() + '-intersects').replace(dblSlashes, '/');
                configsArray.push({
                    outputFile: path.join(applicationRoot, configPath + '.js'),
                    orderQueue: namespacesForConfigs[namespace],
                    packagePath: configPath
                });
                //также добавляем конфиг пересечений для данного неймспейса в бандлы
                bundlesOptions.bundles[configPath] = namespacesForConfigs[namespace];
            });

        };

        collectDepsAndIntersectsDone = function() {
            applicationRoot = applicationRoot.replace(dblSlashes, '/');
            deleteIntersectsFromPackages();
        };

        deleteIntersectsFromPackages = function() {
            async.eachLimit(configsArray, 10, function(config, done) {
                config.orderQueue = config.orderQueue.filter(function(node){
                    return !bundlesOptions.intersects[node.fullName];

                });

                //также убираем пересечения из конфига конкретного бандла
                if (bundlesOptions.bundles[config.packagePath]) {
                    bundlesOptions.bundles[config.packagePath] = bundlesOptions.bundles[config.packagePath].filter(function(module){
                        return !bundlesOptions.intersects[module];
                    });
                }
                done();
            }, startCreateCustomPacks);
        };

        startCreateCustomPacks = function() {
            generateIntersectsConfig();
            customPackage.createGruntPackage(grunt, configsArray, root, badConfigs, bundlesOptions, taskDone);
        };

        taskDone = function (errors) {
            var packageNames = Object.keys(errors);
            if (packageNames.length > 0) {
                packageNames.forEach(function(packageName) {
                   grunt.log.ok('Ошибка в кастомном пакете ' + packageName);
                   grunt.log.error(errors[packageName]);
                });
                grunt.log.error('Fatal error: Некоторые кастомные пакеты не были созданы. Данные пакеты будут проигнорированы и не попадут в бандлы. Подробнее в логах билдера');
            } else {
                grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача создания кастомных пакетов выполнена.');
            }

            applicationRoot = applicationRoot.replace(dblSlashes, '/');
            if (wsRoot !== 'ws') {
                saveBundlesForEachModule(grunt, applicationRoot);
            }
            bundlesRoutePath = path.join(wsRoot, bundlesPath, 'bundlesRoute').replace(dblSlashes, '/');
            grunt.file.write(path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.js'), `bundles=${JSON.stringify(bundlesOptions.bundles)};`);
            grunt.log.ok(`Записали bundles.js по пути: ${path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.js')}`);
            grunt.file.write(path.join(applicationRoot, wsRoot, bundlesPath, 'output.json'), `${JSON.stringify(bundlesOptions.outputs)}`);
            grunt.log.ok(`Записали output.json по пути: ${path.join(applicationRoot, wsRoot, bundlesPath, 'output.json')}`);
            grunt.file.write(path.join(applicationRoot, `${bundlesRoutePath}.json`), JSON.stringify(bundlesOptions.modulesInBundles));
            grunt.log.ok(`Записали bundlesRoute.json по пути: ${path.join(applicationRoot, `${bundlesRoutePath}.json`)}`);
            grunt.file.write(path.join(applicationRoot, `${bundlesRoutePath}.js`), `define("${bundlesRoutePath}",[],function(){return ${JSON.stringify(bundlesOptions.modulesInBundles)};});`);
           /**
            * Таска минификации выполняется до кастомной паковки, поэтому мы должны для СП также
            * сохранить .min бандл
            */
           if (bundlesOptions.splittedCore) {
               grunt.file.write(path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.min.js'), `bundles=${JSON.stringify(bundlesOptions.bundles)};`);
               grunt.log.ok(`Записали bundles.min.js по пути: ${path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.min.js')}`);
            }
            done();
        };

        if (!modDeps.checkModuleDependenciesSanity(applicationRoot, taskDone)) {
            return;
        }

        dg = modDeps.getDependencyGraph(applicationRoot);

        var sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);

        /**
         * Не рассматриваем конфигурации, которые расположены в директории ws, если сборка
         * для Сервиса Представлений, поскольку конфигурации из ws являются дублями конфигураций
         * из WS.Core и один и тот же код парсится дважды.
         */
        if (wsRoot !== 'ws') {
            sourceFiles = sourceFiles.filter(function(pathToSource){
                return !/^ws/.test(pathToSource);
            });
        }

        sourceFiles.forEach(function (pathToSource) {
            configsFiles.push(path.join(applicationRoot, pathToSource));
        });

        configsArray = customPackage.getConfigs(grunt, configsFiles, applicationRoot, badConfigs);

        if (badConfigs && badConfigs.length > 0) {
            var errorMessage = '[ERROR] Опция "include" отсутствует или является пустым массивом!' +
                ' Список конфигурационных файлов с данной ошибкой: ';
            errorMessage += badConfigs.map(function(item) {
                return '"' + item.path + '"';
            }).join(', ');
            grunt.log.error(errorMessage);
        }

        bundlesOptions.splittedCore = this.data.splittedCore;
        customPackage.collectDepsAndIntersects(dg, configsArray, applicationRoot, wsRoot, bundlesOptions, collectDepsAndIntersectsDone);
    };
}

function gruntPackCSS(grunt) {
    return function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача паковки css.');

        var root = this.data.root,
            applicationRoot = path.join(root, this.data.application),
            htmlFiles = [];

        var sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);
        sourceFiles.forEach(function (pathToSource) {
            htmlFiles.push(path.join(applicationRoot, pathToSource));
        });

        packCSS(htmlFiles, root, path.join(applicationRoot, this.data.packages));

        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача паковки css выполнена.');
    }
}

function gruntPackJS(grunt) {
    return function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача паковки js.');

        var root = this.data.root,
            applicationRoot = path.join(root, this.data.application),
            htmlFiles = [];

        var sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);
        sourceFiles.forEach(function (pathToSource) {
            htmlFiles.push(path.join(applicationRoot, pathToSource));
        });

        packJS(htmlFiles, root, path.join(applicationRoot, this.data.packages));

        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача паковки js выполнена.');
    }
}

function gruntPrepackJs(grunt) {
    return function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача prepackjs.');
        var root = grunt.option('root') || '',
           app = grunt.option('application') || '',
           rootPath = path.join(root, app),
           sourceFiles = grunt.file.expand({cwd: rootPath}, this.data.src);

        sourceFiles.forEach(function (fPath) {
            var fContent = grunt.file.read(path.join(rootPath, fPath)),
               packStorage = {
                   modules: {},
                   content: null
               };

            packStorage.content = prepackJs(fContent, packStorage);

            if (packStorage.content) {
                grunt.file.write(fPath.replace(jsExtReg, '.esp.json'), JSON.stringify(packStorage));
            }
        });

        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача prepackjs выполнена.');
    }
}

module.exports = function (grunt) {
    grunt.registerMultiTask('packwsmod', 'TODO', gruntPackModules(grunt));
    grunt.registerMultiTask('owndepspack', 'TODO', gruntPackOwnDependencies(grunt));
    grunt.registerMultiTask('collect-dependencies', 'TODO', gruntCollectDependencies(grunt));
    grunt.registerMultiTask('deanonymize', 'TODO', gruntDeanonymizeDefine(grunt));
    grunt.registerMultiTask('custompack', 'TODO', gruntCustomPack(grunt));
    grunt.registerMultiTask('packcss', 'TODO', gruntPackCSS(grunt));
    grunt.registerMultiTask('packjs', 'TODO', gruntPackJS(grunt));
    grunt.registerMultiTask('prepackjs', 'TODO', gruntPrepackJs(grunt));
};
