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

module.exports = function (grunt) {
    grunt.registerMultiTask('convert', 'transliterate paths', function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача конвертации ресурсов');
        var start = Date.now();

        var input = grunt.option('input'),
            symlink = grunt.option('symlink'),
            modules = (grunt.option('modules') || '').replace(/"/g, ''),
            service_mapping = grunt.option('service_mapping') || false,
            i18n = !!grunt.option('index-dict'),
            resourcesPath = path.join(this.data.cwd, 'resources'),
            contents = {},
            contentsModules = {},
            xmlContents = {},
            htmlNames = {},
            jsModules = {},
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
                        _remove();
                    } else {
                        grunt.fail.fatal(err);
                    }
                }
            })();
        }

        remove();

        paths.forEach(function (input, i) {
            var parts = input.replace(dblSlashes, '/').split('/');
            var moduleName = '';
            if (modules) {
                moduleName = parts[parts.length - 1];
                contentsModules[moduleName] = transliterate(moduleName);
            }
            grunt.file.recurse(input, function (abspath) {
                var ext = path.extname(abspath);

                if (isXmlDeprecated.test(abspath)) {
                    var basexml = path.basename(abspath, '.xml.deprecated');
                    xmlContents[basexml] = path.join(transliterate(moduleName),
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
                                        jsModules[parts[1]] = path.join(transliterate(moduleName),
                                            transliterate(path.relative(input, abspath))).replace(dblSlashes, '/');
                                    }
                                }
                            }
                        }
                    });
                }

                var dest = path.join(resourcesPath, transliterate(moduleName),
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
            });
            grunt.log.ok('[' + prc(i + 1, paths.length) + '%] completed!');
        });

        try {
            contents.modules = Object.keys(contentsModules).length ? contentsModules : contents.modules;
            contents.xmlContents = xmlContents;
            contents.jsModules = jsModules;
            contents.htmlNames = htmlNames;

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