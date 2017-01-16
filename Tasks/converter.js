'use strict';

var path = require('path');
var fs = require('fs-extra');
var async = require('async');
var mkdirp = require('mkdirp');
var transliterate = require('./../lib/utils/transliterate');
var esprima = require('esprima');
var traverse = require('estraverse').traverse;

var dblSlashes = /\\/g;
var isXmlDeprecated = /\.xml\.deprecated$/;
var isHtmlDeprecated = /\.html\.deprecated$/;
var isModuleJs = /\.module\.js$/;

function prc(x, all) {
    return Math.floor((x * 100) / all);
}

function mkSymlink(target, dest) {
    var link = function (target, dest) {
        try {
            fs.symlinkSync(target, dest);
        } catch (err) {
            if (err && err.code === 'ENOENT') {
                mkdirp.sync(path.dirname(dest));
                link(target, dest);
            }
        }
    };

    link(target, dest);
}

function parseModule(module) {
    var res;
    try {
        res = esprima.parse(module);
    } catch (e) {
        res = e;
    }
    return res;
}

function getFirstLevelDirs(resourcesPath) {
    var dirs;

    dirs = fs.readdirSync(resourcesPath).map(function (e) {
        return path.join(resourcesPath, e);
    });

    return dirs.filter(function (e) {
        return fs.statSync(e).isDirectory();
    });
}

module.exports = function (grunt) {
    grunt.registerMultiTask('convert', 'transliterate paths', function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача конвертации ресурсов');
        var start = Date.now();

        var input = grunt.option('input'),
            symlink = grunt.option('symlink'),
            modules = (grunt.option('modules') || '').replace(/"/g, ''),
            service_mapping = grunt.option('service_mapping') || false,
            i18n = !!grunt.option('index-dict'),
            dryRun = grunt.option('dry-run'),
            application = grunt.option('application') || '',
            root = this.data.root,
            applicationRoot = this.data.cwd,
            resourcesPath = path.join(applicationRoot, 'resources'),
            contents = {},
            contentsModules = {},
            xmlContents = {},
            htmlNames = {},
            jsModules = {},
            requirejsPaths = {},
            paths;

        if (modules) {
            paths = modules.split(';');

            if (paths.length == 1 && grunt.file.isFile(paths[0])) {
                input = paths[0];
                try {
                    paths = grunt.file.readJSON(input);
                    if (!Array.isArray(paths)) {
                        grunt.log.error('Parameter "modules" incorrect');
                        return;
                    }
                } catch (e) {
                    grunt.log.error('Parameter "modules" incorrect. Can\'t read ' + input);
                    return;
                }
            }
        } else {
            paths = [input];
        }

        function remove() {
            let attempt = 3;

            (function _remove() {
                try {
                    fs.removeSync(resourcesPath);
                } catch (err) {
                    if (--attempt) {
                        setTimeout(_remove, 1000);
                    } else {
                        grunt.fail.fatal(err);
                    }
                }
            })();
        }

        if (!dryRun) remove();

        paths.forEach(function (input, i) {
            var parts = input.replace(dblSlashes, '/').split('/');
            var moduleName = '';
            var tsdModuleName = '';
            if (modules) {
                moduleName = parts[parts.length - 1];
                tsdModuleName = transliterate(moduleName);
                contentsModules[moduleName] = tsdModuleName;

                requirejsPaths[tsdModuleName] = path.join(application, 'resources', tsdModuleName).replace(dblSlashes, '/');
            }
            grunt.file.recurse(input, function (abspath) {
                var ext = path.extname(abspath);

                if (isXmlDeprecated.test(abspath)) {
                    var basexml = path.basename(abspath, '.xml.deprecated');
                    xmlContents[basexml] = path.join(tsdModuleName,
                        transliterate(path.relative(input, abspath).replace('.xml.deprecated', ''))).replace(dblSlashes, '/');
                }

                if (isHtmlDeprecated.test(abspath)) {
                    var basehtml = path.basename(abspath, '.deprecated');
                    var parts = basehtml.split('#');
                    htmlNames[parts[0]] = (parts[1] || parts[0]).replace(dblSlashes, '/');
                }

                if (isModuleJs.test(abspath)) {
                    var text = grunt.file.read(abspath);
                    var ast = parseModule(text);

                    if (ast instanceof Error) {
                        ast.message += '\nPath: ' + abspath;
                        return grunt.fail.fatal(ast);
                    }

                    traverse(ast, {
                        enter: function getModuleName(node) {
                            if (node.type == 'CallExpression' && node.callee.type == 'Identifier' &&
                                node.callee.name == 'define') {
                                if (node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
                                    var mod = node.arguments[0].value;
                                    var parts = mod.split('!');
                                    if (parts[0] == 'js') {
                                        jsModules[parts[1]] = path.join(tsdModuleName,
                                            transliterate(path.relative(input, abspath))).replace(dblSlashes, '/');
                                    }
                                }
                            }
                        }
                    });
                }

                if (!dryRun) {
                    var dest = path.join(resourcesPath, tsdModuleName,
                        transliterate(path.relative(input, abspath)));

                    if (!symlink || (i18n && (ext == '.xhtml' || ext == '.html'))) {
                        try {
                            grunt.file.copy(abspath, dest);
                            fs.chmodSync(dest, '0666');
                        } catch (err) {
                            grunt.log.error(err);
                        }
                    } else {
                        mkSymlink(abspath, dest);
                    }
                }
            });
            grunt.log.ok('[' + prc(i + 1, paths.length) + '%] completed!');
        });

        try {
            contents.modules = contentsModules;
            contents.xmlContents = xmlContents;
            contents.jsModules = jsModules;
            contents.htmlNames = htmlNames;

            if (!Object.keys(requirejsPaths).length && !modules) {
                var firstLvlDirs = getFirstLevelDirs(resourcesPath);
                firstLvlDirs.forEach(function (dir) {
                    dir = path.relative(root, dir).replace(dblSlashes, '/');
                    requirejsPaths[dir.split('/').pop()] = dir;
                });
            }
            requirejsPaths.WS = path.join(application, 'ws/').replace(dblSlashes, '/');

            contents.requirejsPaths = requirejsPaths;

            if (service_mapping) {
                var srv_arr = service_mapping.trim().split(' ');
                if (srv_arr.length % 2 == 0) {
                    var services = {};
                    for (var i = 0; i < srv_arr.length; i += 2) {
                        services[srv_arr[i]] = srv_arr[i + 1];
                    }
                    contents.services = services;
                } else {
                    grunt.fail.fatal("Services list must be even!");
                }
            }

            grunt.file.write(path.join(resourcesPath, 'contents.json'), JSON.stringify(contents, null, 2));
            grunt.file.write(path.join(resourcesPath, 'contents.js'), 'contents=' + JSON.stringify(contents));
        } catch (err) {
            grunt.fail.fatal(err);
        }

        console.log('Duration: ' + (Date.now() - start));
    });
};