'use strict';

const path              = require('path');
const gutil             = require('gulp-util');
const argv              = require('yargs').argv;
const esprima           = require('esprima');
const estraverse        = require('estraverse');
const codegen           = require('escodegen');
const translit          = require('../../lib/utils/transliterate');
const getMeta           = require('grunt-wsmod-packer/lib/getDependencyMeta.js');
const reIsRemote        = /^http[s]?:|^\/\//i;


exports.anonymousCheck = opts => {
    if (!opts.node || !opts.acc) return;
    let node  = opts.node;
    let file  = opts.file;

    if (node.type == 'CallExpression' && node.callee.type == 'Identifier' && node.callee.name == 'define') {
        if (node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
            fillBadRequireDeps(opts, node.arguments[1].elements);
        } else if (node.arguments[0].type == 'ArrayExpression') {
            opts.acc.markAsAnonymous(file.path);
            opts.acc.fillAnonymous(file.path);
            fillBadRequireDeps(opts, node.arguments[0].elements);
        } else if (node.arguments[0].type == 'FunctionExpression') {
            opts.acc.markAsAnonymous(file.path);
            opts.acc.fillAnonymous(file.path);
        }
    }
};

function fillBadRequireDeps(opts, deps) {
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

    opts.acc.fillBadRequireDeps(deps, opts.file.path);
}

exports.execute = opts => {
    findNames(opts, argv.root)
};

function findNames(opts, root) {
    let rjsPaths                = (global.requirejs.s.contexts['_'].config.paths) || {};
    let foundNames              = {};
    let anonKeys                = Object.keys(opts.acc.deanonymizeData.anonymous);
    let keys                    = Object.keys(opts.acc.deanonymizeData.badRequireDeps);
    let requirejsPathResolver   = global.requirejs('Core/pathResolver');

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
        let moduleAndPath = dep.trim().split('/'),
            module = moduleAndPath.shift(),
            pathToFile = moduleAndPath.join('/'),
            resolvePath;

        if (rjsPaths[module]) {
            if (/^ws[\/\\]/.test(rjsPaths[module])) {
                resolvePath = path.join(rjsPaths[module], pathToFile); // 'ws/core'/helpers/fast-control-helpers'
            } else {
                for (let i = 0, l = opts.acc.modules.length; i < l; i++) {
                    let modulePathTranslited = translit(opts.acc.modules[i]);
                    if (modulePathTranslited.endsWith(module)) resolvePath = path.join(modulePathTranslited, pathToFile);
                }
            }
        } else if (dep.indexOf('!') > -1) {
            let moduleAndPlugin = module.split('!'),
                plugin          = moduleAndPlugin[0], // js
                moduleName      = moduleAndPlugin[1]; // WS.Data

            if (moduleName && rjsPaths[moduleName]) {
                for (let i = 0, l = opts.acc.modules.length; i < l; i++) {
                    let modulePathTranslited = translit(opts.acc.modules[i]);
                    if (modulePathTranslited.endsWith(module)) resolvePath = path.join(modulePathTranslited, pathToFile);
                }
            } else if (moduleName && plugin) {
                try {
                    resolvePath = requirejsPathResolver(moduleName, plugin);
                    resolvePath = path.join(path.dirname(resolvePath), pathToFile);
                } catch (e) {
                    // gutil.log('Error resolve path to module %s: %s', dep, e);
                }
            }
        }

        if (!/\.js$/.test(resolvePath)) resolvePath += '.js';

        if (resolvePath.startsWith('resources')) {
            resolvePath = resolvePath.replace(/^resources[\/\\]/, '');

            for (let i = 0, l = opts.acc.modules.length; i < l; i++) {
                let mBaseTr = translit(path.basename(opts.acc.modules[i]));
                if (resolvePath.startsWith(mBaseTr)) resolvePath = path.join(opts.acc.modules[i], '../', resolvePath);
            }
        } else {
            resolvePath = path.join(root, resolvePath);
        }
        resolvePath = translit(resolvePath);

        for (let aPath in opts.acc.deanonymizeData.anonymous) {
            if (translit(aPath) == resolvePath) foundNames[aPath] = dep;
        }
    }

    if (anonKeys.length) keys.forEach(resolveName);

    deanonymize(foundNames, opts);
}

function deanonymize (foundNames, opts) {
    let acc     = opts.acc.acc;
    for (let file in acc) {
        if (acc[file] && acc[file].__anonymous) {
            let wasModified = false;
            let ast         = esprima.parse(acc[file].contents);
            estraverse.traverse(ast, {
                enter: function (node) {
                    if (node.type == 'CallExpression' && node.callee.type == 'Identifier' &&
                        node.callee.name == 'define' && (
                        node.arguments[0].type == 'ArrayExpression' || node.arguments[0].type == 'FunctionExpression')) {
                        let modulePath = foundNames[acc[file].path];
                        if (modulePath) {
                            modulePath = modulePath.replace(/\\/g, '/');
                            node.arguments.unshift({
                                type: 'Literal',
                                value: modulePath,
                                raw: JSON.stringify(modulePath)
                            });
                            wasModified = true;
                        }

                    }
                }
            });

            if (wasModified) opts.acc.setFileContents(file, codegen.generate(ast));
        }
    }
}