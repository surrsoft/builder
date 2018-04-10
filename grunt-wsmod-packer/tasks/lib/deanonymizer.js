var esprima = require('esprima');
var traverse = require('estraverse').traverse;
var codegen = require('escodegen');
var async = require('async');
var path = require('path');
var fs = require('fs');
var getMeta = require('./../../lib/getDependencyMeta');

var reIsRemote = /^http[s]?:|^\/\//i;

function deanonymize(grunt, foundNames, taskDone) {
    var jsFiles = Object.keys(foundNames);

    grunt.log.ok('Deanonymize %s files', jsFiles.length);

    async.eachLimit(jsFiles, 10, function (fullPath, done) {
        fs.readFile(fullPath, 'utf8', function parseModule(err, res) {
            var wasModified = 0;
            if (err) {
                done(err);
            } else {
                try {
                    var ast = esprima.parse(res);
                    traverse(ast, {
                        enter: function getModuleName(node) {
                            if (node.type == 'CallExpression' && node.callee.type == 'Identifier' &&
                                node.callee.name == 'define' && (
                                node.arguments[0].type == 'ArrayExpression' || node.arguments[0].type == 'FunctionExpression')) {

                                var modulePath = foundNames[fullPath].replace(/\\/g, '/');
                                node.arguments.unshift({
                                    type: 'Literal',
                                    value: modulePath,
                                    raw: JSON.stringify(modulePath)
                                });
                                wasModified++;
                            }
                        }
                    });

                    if (wasModified) {
                        grunt.log.ok('Deanonymize %s', fullPath);
                        fs.writeFile(fullPath, codegen.generate(ast), function (err) {
                            if (err) {
                                done(err);
                            } else {
                                done();
                            }
                        })
                    } else {
                        done();
                    }
                } catch (err) {
                    done(err);
                }
            }
        });
    }, function (err) {
        if (err) {
            taskDone(err);
        } else {
            taskDone();
        }
    });
}

function findNames(grunt, anonymous, badRequireDeps, root, taskDone) {
    var rjsPaths = (global.requirejs.s.contexts['_'].config.paths) || {};
    var foundNames = {};
    var anonKeys = Object.keys(anonymous);
    var keys = Object.keys(badRequireDeps);
    var requirejsPathResolver = global.requirejs('Core/pathResolver');

    function resolvePluginsWithParameters(module) {
        var
            pluginsToResolveInBuilder = {
                'html!encode=true': 'html!',
                'is!browser': ''
            },
            parts = module.split('?');

        for (var i = 0; i < parts.length; i++) {
            var
                currentPart = parts[i],
                pluginsInCurrentPath = currentPart.split('!'),
                currentPluginWithParameter;
            if (pluginsInCurrentPath.length > 2) {
                currentPluginWithParameter = [pluginsInCurrentPath.pop(), pluginsInCurrentPath.pop()].reverse().join('!');
            } else {
                currentPluginWithParameter = currentPart;
            }
            if (pluginsToResolveInBuilder.hasOwnProperty(currentPluginWithParameter)) {
                parts[i] = currentPart.replace(currentPluginWithParameter, pluginsToResolveInBuilder[currentPluginWithParameter]);
            }
        }
        return parts.join('');
    }

    function resolveName(dep) {
        dep = resolvePluginsWithParameters(dep);
        var moduleAndPath = dep.trim().split('/'),
            module = moduleAndPath.shift(),
            pathToFile = moduleAndPath.join('/'),
            resolvePath;

        if (rjsPaths[module]) {
            resolvePath = path.join(rjsPaths[module], pathToFile);
        } else if (dep.indexOf('!') > -1) {
            var moduleAndPlugin = module.split('!'),
                plugin = moduleAndPlugin[0],
                moduleName = moduleAndPlugin[1];

            if (moduleName && rjsPaths[moduleName]) {
                resolvePath = path.join(rjsPaths[moduleName], pathToFile);
            } else if (moduleName && plugin) {
                try {
                    resolvePath = requirejsPathResolver(moduleName, plugin);
                    resolvePath = path.join(path.dirname(resolvePath), pathToFile);
                } catch (e) {
                    if ('optional' !== plugin) {
                        if (e instanceof ReferenceError) {
                            grunt.log.ok(`${e.message}.\nDependency: ${dep}\nPath to original module: ${badRequireDeps[dep]}\nSKIPPED`);
                        } else {
                            grunt.log.ok('Error resolve path to module %s: %s . Path to module with badRequirePath: %s', dep, e, badRequireDeps[dep]);
                        }
                    }
                }
            }
        }

        if (!/\.js$/.test(resolvePath)) {
            resolvePath += '.js';
        }

        resolvePath = path.normalize(resolvePath);
        if (anonymous[resolvePath]) {
            foundNames[path.join(root, resolvePath)] = dep;
        }
    }

    grunt.log.ok("Found anonymous " + anonKeys.length + " files");
    if (anonKeys.length) {
        grunt.log.ok("Found " + keys.length + " complex dependencies");
        keys.forEach(resolveName);
    }

    deanonymize(grunt, foundNames, taskDone);
}

function fillBadRequireDeps(fullPath, badRequireDeps, deps) {
    deps = (deps && deps instanceof Array) ? deps : [];
    deps = deps
        .map(function getValue(o) {
            return (!o || o.type !== 'Literal') ? '' : o.value;
        }).reduce(function (memo, dep) {
            var meta = getMeta(dep);
            if (meta.plugin == 'is') {
                meta.moduleYes && memo.push(meta.moduleYes.fullName);
                meta.moduleNo && memo.push(meta.moduleNo.fullName);
            } else if (meta.plugin == 'browser' || meta.plugin == 'optional') {
                memo.push(meta.moduleIn.fullName);
            } else {
                memo.push(meta.fullName);
            }

            return memo;
        }, [])
        .filter(function notRemoteFile(dep) {
            return dep && !reIsRemote.test(dep);
        })
        .filter(function getMeta(dep) {
            return dep && dep.indexOf('/') > -1;
        });

    deps.forEach(function (dep) {
        var appRoot = process.env.ROOT;
        badRequireDeps[dep] = fullPath.replace(appRoot + '\\', '');
    })
}

function deanonymizer(grunt, jsFiles, root, taskDone) {
    grunt.log.ok("Analyze " + jsFiles.length + " files");

    var anonymous = {};
    var badRequireDeps = {};

    async.eachLimit(jsFiles, 10, function (fullPath, done) {
        grunt.log.debug('Analyze %s', fullPath);
        fs.readFile(fullPath, 'utf8', function parseModule(err, res) {
            if (err) {
                done(err);
            } else {
                try {
                    var ast = esprima.parse(res);
                    traverse(ast, {
                        enter: function getModuleName(node) {
                            if (node.type == 'CallExpression' && node.callee.type == 'Identifier' && node.callee.name == 'define') {

                                if (node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
                                    fillBadRequireDeps(fullPath, badRequireDeps, node.arguments[1].elements)
                                } else if (node.arguments[0].type == 'ArrayExpression') {
                                    anonymous[path.relative(root, fullPath)] = 1;
                                    fillBadRequireDeps(fullPath, badRequireDeps, node.arguments[0].elements);
                                } else if (node.arguments[0].type == 'FunctionExpression') {
                                    anonymous[path.relative(root, fullPath)] = 1;
                                }
                            }
                        }
                    });

                    done();
                } catch (err) {
                    grunt.fail.fatal('Error analyze file ' + fullPath + ': ' + fullPath + '\n' + err);
                    done();
                }
            }
        });
    }, function (err) {
        if (err) {
            taskDone(err);
        } else {
            findNames(grunt, anonymous, badRequireDeps, root, taskDone);
        }
    });
}

module.exports = deanonymizer;