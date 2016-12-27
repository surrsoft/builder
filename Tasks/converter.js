'use strict';

let path = require('path');
let fs = require('fs-extra');
let async = require('async');
let mkdirp = require('mkdirp');
let transliterate = require('./../lib/utils/transliterate');
let esprima = require('esprima');
let traverse = require('estraverse').traverse;
let humanize = require('humanize');

const dblSlashes = /\\/g;
const isXmlDeprecated = /\.xml\.deprecated$/;
const isHtmlDeprecated = /\.html\.deprecated$/;
const isModuleJs = /\.module\.js$/;

let
    contents = {},
    contentsModules = {},
    xmlContents = {},
    htmlNames = {},
    jsModules = {},
    requirejsPaths = {};

function prc(x, all) {
    return Math.floor((x * 100) / all);
}

function _mkSymlink(target, dest, cb) {
    let link = function (target, dest, cb) {
        fs.symlink(target, dest, (err) => {
            if (err && err.code === 'ENOENT') {
                mkdirp(path.dirname(dest), (err) => {
                    if (!err || err.code === 'EEXIST') {
                        link(target, dest, cb);
                    } else {
                        console.log(`[ERROR]: ${err}`);
                        cb();
                    }
                });
            } else if (err && err.code !== 'EEXIST') {
                console.log(`[ERROR]: ${err}`);
                cb();
            } else {
                cb();
            }
        });
    };

    link(target, dest, cb);
}

function _writeFile(dest, data, cb) {
    let options = { flag: 'w' };

    let writeFile = function (dest, data, options, cb) {
        fs.writeFile(dest, data, options, function (err) {
            if (err && err.code === 'ENOENT') {
                mkdirp(path.dirname(dest), function (err) {
                    if (!err || err.code === 'EEXIST') {
                        writeFile(dest, data, options, cb);
                    } else {
                        console.log(`[ERROR]: ${err}`);
                        cb();
                    }
                });
            } else if (err) {
                console.log(`[ERROR]: ${err}`);
                cb();
            } else {
                cb();
            }
        });
    };

    writeFile(dest, data, options, cb);
}

function _copyFile(target, dest, data, cb) {
    if (data) {
        _writeFile(dest, data, cb);
    } else {
        fs.readFile(target, (err, data) => {
            if (err) {
                console.log(`[ERROR]: ${err}`);
                cb();
            } else {
                _writeFile(dest, data, cb);
            }
        });
    }
}

function parseModule(module) {
    let res;
    try {
        res = esprima.parse(module);
    } catch (e) {
        res = e;
    }
    return res;
}

function getModuleName(tsdModuleName, abspath, input, node) {
    if (node.type == 'CallExpression' && node.callee.type == 'Identifier' &&
        node.callee.name == 'define') {
        //noinspection JSAnnotator
        if (node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
            //noinspection JSAnnotator
            let mod = node.arguments[0].value;
            let parts = mod.split('!');
            if (parts[0] == 'js') {
                jsModules[parts[1]] = path.join(tsdModuleName,
                    transliterate(path.relative(input, abspath))).replace(dblSlashes, '/');
            }
        }
    }
}

module.exports = function (grunt) {
    grunt.registerMultiTask('convert', 'transliterate paths', function () {
        grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача конвертации ресурсов`);
        const start = Date.now();
        const done = this.async();
        const
            symlink = !!grunt.option('symlink'),
            modules = (grunt.option('modules') || '').replace(/"/g, ''),
            service_mapping = grunt.option('service_mapping') || false,
            i18n = !!grunt.option('index-dict'),
            dryRun = grunt.option('dry-run'),
            applicationRoot = this.data.cwd,
            resourcesPath = path.join(applicationRoot, 'resources');

        let i = 0;
        let paths = modules.split(';');

        if (paths.length == 1 && grunt.file.isFile(paths[0])) {
            let input = paths[0];
            try {
                paths = grunt.file.readJSON(input);
                if (!Array.isArray(paths)) {
                    grunt.log.error('Parameter "modules" incorrect');
                    return;
                }
            } catch (e) {
                grunt.log.error(`Parameter "modules" incorrect. Can\'t read ${input}`);
                return;
            }
        }

        function copyFile(target, dest, data, cb) {
            let ext = path.extname(target);
            if (!symlink || (i18n && (ext == '.xhtml' || ext == '.html'))) {
                _copyFile(target, dest, data, cb);
            } else {
                _mkSymlink(target, dest, cb);
            }
        }

        function recurse(tsdModuleName, origin, input, callback) {
            fs.readdir(input, function (err, files) {
                if (!err){
                    async.each(files, function (file, cb) {
                        let abspath = path.join(input, file);

                        fs.lstat(abspath, function (err, stats) {
                            if (!err) {
                                if (stats.isDirectory()) {
                                    recurse(tsdModuleName, origin, abspath, cb);
                                } else {
                                    let dest = path.join(resourcesPath, tsdModuleName,
                                        transliterate(path.relative(origin, abspath)));

                                    if (isXmlDeprecated.test(abspath)) {
                                        let basexml = path.basename(abspath, '.xml.deprecated');
                                        xmlContents[basexml] = path.join(tsdModuleName,
                                            transliterate(path.relative(origin, abspath).replace('.xml.deprecated', ''))).replace(dblSlashes, '/');

                                        if (!dryRun) {
                                            copyFile(abspath, dest, null, cb);
                                        }
                                    } else if (isHtmlDeprecated.test(abspath)) {
                                        let basehtml = path.basename(abspath, '.deprecated');
                                        let parts = basehtml.split('#');
                                        htmlNames[parts[0]] = (parts[1] || parts[0]).replace(dblSlashes, '/');

                                        if (!dryRun) {
                                            copyFile(abspath, dest, null, cb);
                                        }
                                    } else if (isModuleJs.test(abspath)) {
                                        fs.readFile(abspath, function (err, text) {
                                            let ast = parseModule(text.toString());

                                            if (ast instanceof Error) {
                                                ast.message += '\nPath: ' + file;
                                                grunt.fail.fatal(err);
                                                return cb(ast);
                                            }

                                            traverse(ast, {
                                                enter: function (node) {
                                                    getModuleName(tsdModuleName, abspath, origin, node);
                                                }
                                            });
                                            if (!dryRun) {
                                                copyFile(abspath, dest, text, cb);
                                            }
                                        });
                                    } else if (!dryRun) {
                                        copyFile(abspath, dest, null, cb);
                                    }
                                }
                            } else {
                                console.error(err);
                            }
                        });
                    }, function () {
                        callback();
                    });
                } else {
                    console.error(err);
                }
            });
        }

        function remove() {
            let attempt = 1;
            let start = Date.now();

            (function _remove() {
                try {
                    grunt.log.ok(`${humanize.date('H:i:s')}: Запускается удаление ресурсов(${attempt})`);
                    fs.removeSync(resourcesPath);
                    grunt.log.ok(`${humanize.date('H:i:s')}: Удаление ресурсов завершено(${(Date.now() - start) / 1000} sec)`);
                    main();
                } catch (err) {
                    if (++attempt <= 3) {
                        setTimeout(_remove, 1000);
                    } else {
                        grunt.fail.fatal(err);
                    }
                }
            })();
        }

        if (!dryRun) {
            remove();
        } else {
            main();
        }

        function main() {
            async.eachLimit(paths, 1, function (input, callback) {
                let parts = input.replace(dblSlashes, '/').split('/');
                let moduleName = parts[parts.length - 1];
                let tsdModuleName = transliterate(moduleName);
                contentsModules[moduleName] = tsdModuleName;
                requirejsPaths[tsdModuleName] = path.join('resources', tsdModuleName).replace(dblSlashes, '/');

                recurse(tsdModuleName, input, input, function () {
                    grunt.log.ok(`[${prc(i++, paths.length)}%] ${input}`);
                    callback();
                });
            }, function (err) {
                if (err) {
                    return grunt.fail.fatal(err);
                }

                try {
                    contents.modules = contentsModules;
                    contents.xmlContents = xmlContents;
                    contents.jsModules = jsModules;
                    contents.htmlNames = htmlNames;

                    requirejsPaths.WS = 'ws/';

                    contents.requirejsPaths = requirejsPaths;

                    if (service_mapping) {
                        let srv_arr = service_mapping.trim().split(' ');
                        if (srv_arr.length % 2 == 0) {
                            let services = {};
                            for (let i = 0; i < srv_arr.length; i += 2) {
                                services[srv_arr[i]] = srv_arr[i + 1];
                            }
                            contents.services = services;
                        } else {
                            grunt.fail.fatal('Services list must be even!');
                        }
                    }

                    grunt.file.write(path.join(resourcesPath, 'contents.json'), JSON.stringify(contents, null, 2));
                    grunt.file.write(path.join(resourcesPath, 'contents.js'), 'contents=' + JSON.stringify(contents));
                } catch (err) {
                    grunt.fail.fatal(err);
                }

                console.log(`Duration: ${(Date.now() - start) / 1000} sec`);
                done();
            });
        }
    });
};