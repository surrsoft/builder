'use strict';

const path           = require('path');
const gutil          = require('gulp-util');
const argv           = require('yargs').argv;

let inited = false;

let jsCoreModules, jsModules, modules, rjsPaths, i18n, availableLangs, requirejsPathResolver;
const applicationRoot       = path.join(argv.root, argv.application);
const getMeta               = require('grunt-wsmod-packer/lib/getDependencyMeta');
const dblSlashes            = /\\/g;
let supportedPlugins        = ['js', 'html', 'css', 'json', 'xml', 'text', 'native-css', 'browser', 'optional', 'i18n', 'tmpl'];
let pluginsOnlyDeps         = ['cdn', 'preload', 'remote'];
    supportedPlugins        = supportedPlugins.concat(pluginsOnlyDeps);
let systemModules           = ['module', 'require', 'exports'];
let reIsRemote              = /^http[s]?:|^\/\//i;

let modulesDeps = {};
let errMes;

let init = () => {
    let _const              =  global.requirejs('Core/constants');
    jsCoreModules           = map(_const.jsCoreModules, addRoot(path.join(argv.root, argv.application, 'ws')));
    jsModules               = map(_const.jsModules, addRoot(argv.root));
    modules                 = merge(jsCoreModules, jsModules);
    rjsPaths                = global.requirejs.s.contexts['_'].config.paths || {};
    i18n                    = global.requirejs('Core/i18n');
    availableLangs          = Object.keys(i18n.getAvailableLang());
    requirejsPathResolver   = global.requirejs('Core/pathResolver');
    inited = true;
};

exports.traverse = (opts) => {
    if (!inited) init();
    let node = opts.node;

    if (node.type == 'CallExpression' && node.callee.type == 'Identifier' && node.callee.name == 'define') {

        if (node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
            modulesDeps[node.arguments[0].value] = {};
            if (node.arguments[1].type == 'ArrayExpression') {
                modulesDeps[node.arguments[0].value].deps = getDependencies(opts, node.arguments[1].elements);
            }
        } else {
            return;
        }
        modulesDeps[node.arguments[0].value].meta = getMeta(node.arguments[0].value);
        let meta = modulesDeps[node.arguments[0].value].meta;

        if (modules[meta.module]) modules[meta.module] = modules[meta.module].replace(/resources[\/\\]resources/, 'resources');
        let needToRegister = (meta.plugin == 'js' && (!modules[meta.module] || modules[meta.module] == opts.file.dest)) || meta.plugin != 'js';

        if (!Array.isArray(modulesDeps[node.arguments[0].value].deps)) modulesDeps[node.arguments[0].value].deps = [];

        modulesDeps[node.arguments[0].value].deps = addI18NDep(meta, modulesDeps[node.arguments[0].value].deps);

        errMes = `-------- Parent module: "${node.arguments[0].value}"; Parent path: "${opts.file.path}"`;

        if (needToRegister) {
            opts.acc.graph.registerNode(node.arguments[0].value, {
                path: path.relative(applicationRoot, opts.file.dest),
                amd: true
            });
        }
    }
};

exports.execute = opts => {
    for (let mod in modulesDeps) {
        modulesDeps[mod].deps = modulesDeps[mod].deps.map(registerDependencyMayBe.bind(undefined, opts));
        opts.acc.graph.addDependencyFor(mod, modulesDeps[mod].deps);
    }
    modulesDeps = {};
};

function addI18NDep (meta, deps) {
    if (meta.plugin == 'js' && meta.module.indexOf('SBIS3') == 0) {
        let hasLocalization = false;

        deps.forEach(dep => {
            if (dep.module == meta.module && dep.plugin == 'i18n') hasLocalization = true;
        });

        if (!hasLocalization) {
            deps.push({
                fullName: 'i18n!' + meta.module,
                plugin: 'i18n',
                module: meta.module,
                encode: false
            });
        }
    }

    return deps;
}


function map (obj, fn) {
    let result = {};
    Object.keys(obj).forEach(v => { result[v] = fn(obj[v]); });
    return result;
}

function registerDependencyMayBe (opts, dep) {
    if (dep.plugin == 'is') {
        registerNodeMaybe(opts, dep.moduleYes, dep.plugin);
        registerNodeMaybe(opts, dep.moduleNo, dep.plugin);
    } else if (dep.plugin == 'browser' || dep.plugin == 'optional') {
        registerNodeMaybe(opts, dep.moduleIn, dep.plugin);
        getComponentForTmpl(opts, dep.moduleIn);
    } else {
        registerNodeMaybe(opts, dep, dep.plugin);
        getComponentForTmpl(opts, dep);

        // FIXME: getDependenciesForI18N никогда не вызывается...
        getDependenciesForI18N(opts, dep);
    }

    return dep.fullName;
}

function getDependenciesForI18N (opts, mod) {
    if (mod && mod.plugin === 'i18n' && mod.fullPath) {
        try {
            let deps         = [];
            let resourceRoot = path.join(applicationRoot, 'resources');

            availableLangs.forEach(function(lang) {
                var country = lang.split('-')[1];
                var jsonPath = path.join(mod.fullPath, 'lang', lang, lang + '.json');
                var dictPath = jsonPath.replace('.json', '.js');
                var dictModule = path.relative(resourceRoot, dictPath).replace(dblSlashes, '/').replace(isWS, 'WS').replace('.js', '');

                var cssPath = path.join(mod.fullPath, 'lang', lang, lang + '.css');
                var cssModule = 'native-css!' + path.relative(resourceRoot, cssPath).replace(dblSlashes, '/').replace(isCss, '').replace(isWS, 'WS');

                var countryPath = path.join(mod.fullPath, 'lang', country, country + '.css');
                var countryModule = 'native-css!' + path.relative(resourceRoot, countryPath).replace(dblSlashes, '/').replace(isCss, '').replace(isWS, 'WS');

                if (fs.existsSync(cssPath)) {
                    deps.push({plugin: 'native-css', fullPath: cssPath, fullName: cssModule});
                }
                if (fs.existsSync(countryPath)) {
                    deps.push({plugin: 'native-css', fullPath: countryPath, fullName: countryModule});
                }

                if (fs.existsSync(dictPath)) {
                    deps.push({plugin: 'js', fullPath: dictPath, fullName: dictModule});
                }
            });

            deps.forEach(function(dep) {
                if (!opts.acc.graph.hasNode(dep.fullName)) {
                    opts.acc.graph.registerNode(dep.fullName, {
                        path: path.relative(applicationRoot, dep.fullPath)
                    });
                }
            });

            opts.acc.graph.addDependencyFor(mod.fullName, deps.map(function(dep) {return dep.fullName}));
        } catch(err) {
            gutil.log(err);
        }
    }
}

function getComponentForTmpl (opts, mod) {
    if (mod && mod.plugin === 'tmpl' && mod.fullPath) {
        try {
            let text = opts.acc.getFileByDest(mod.fullPath).contents; // FIXME: откуда читать ?

            if (text) {
                let tmplstr = global.requirejs('View/Builder/Tmpl');
                let arr     = tmplstr.getComponents(text).map(function (dp) {
                    return {
                        type: 'Literal',
                        value: dp
                    };
                });
                let d = getDependencies(mod.fullPath, arr);
                opts.acc.graph.addDependencyFor(mod.fullName, d.map(d => {
                    let dm = registerDependencyMayBe.bind(undefined, opts, '');
                    return dm(d)
                }));
            }
        } catch (err) {
            gutil.log(err);
        }
    }
}

function registerNodeMaybe(opts, dep, plugin) {
    if (dep && !opts.acc.graph.hasNode(dep.fullName)) {
        let pathToModule;

        try {
            pathToModule = getModulePath(dep, plugin);
        } catch (e) {
            // ловим эксепшн из pathResolver, чтобы не хламить сборку
        }

        if (pathToModule) {
            dep.fullPath = pathToModule;
            opts.acc.graph.registerNode(dep.fullName, {
                path: path.relative(applicationRoot, dep.fullPath)
            });
        }
    }
}

function getModulePath (dep, plugin) {
    let pathToModule = '';
    try {
        if (dep.module) {
            if (dep.plugin == 'text' || dep.plugin == 'native-css') {
                pathToModule = dep.module;
            } else if (dep.plugin == 'i18n') {
                let jsPath, cssPath, countryPath;
                availableLangs.forEach(function(lang) {
                    jsPath = i18n.getDictPath(dep.module, lang, 'json');
                    cssPath = i18n.getDictPath(dep.module, lang, 'css');
                    countryPath = i18n.getDictPath(dep.module, lang.split('-')[1], 'css');

                    pathToModule = jsPath || cssPath || countryPath || '';
                });

                /**
                 * Если какие-то файлы локализации присутствуют, оставляем путь до папки верхнего уровня,
                 * чтобы в i18nLoader найти в ней словари для всех доступных языков.
                 */
                if (pathToModule) pathToModule = pathToModule.split('lang/')[0];
            } else {
                pathToModule = requirejsPathResolver(dep.module, dep.plugin);
            }
        } else {
            pathToModule = dep.fullName;
        }

        pathToModule = pathToModule ? path.normalize(pathToModule).replace(dblSlashes, '/').replace(/resources[\/\\]resources[\/\\]/, 'resources/') : '';

        if (pathToModule) {
            let ext = path.extname(pathToModule).substr(1);
            if (!ext || (dep.plugin == 'html' ? ext !== 'xhtml' : dep.plugin !== 'text' ? ext !== dep.plugin : false)) {
                /*if (dep.plugin == 'html') {
                    ext = 'xhtml';
                } else if (dep.plugin == 'i18n') {
                    ext = '';
                } else if(dep.plugin == 'native-css') {
                    ext = 'css'
                } else if (!dep.plugin) {
                    ext = 'js';
                } else {
                    ext = dep.plugin;
                }*/
                switch(dep.plugin) {
                    case 'html':
                        ext = 'xhtml';
                        break;
                    case 'i18n':
                        ext = '';
                        break;
                    case 'native-css':
                        ext = 'css';
                        break;
                    default:
                        if (!dep.plugin) {
                            ext = 'js';
                        } else {
                            ext = dep.plugin;
                        }
                        break;
                }
                pathToModule = pathToModule + (ext ? ('.' + ext) : '');
            }
            pathToModule = global.requirejs.toUrl(pathToModule);

            /**
             * Если какие-то файлы локализации присутствуют, оставляем путь до папки верхнего уровня,
             * чтобы в i18nLoader найти в ней словари для всех доступных языков.
             */
            if (dep.plugin == 'i18n') {
                pathToModule = pathToModule.split('lang/')[0];
            }

            /**
             * Если плагин optional и сформированного пути не существует, тогда нету смысла помещать
             * данный путь в module dependencies
             */
            if (plugin == 'optional') {
                if (!fs.existsSync(pathToModule)) {
                    return '';
                }
            }
        }
    } catch (e) {
        if ((plugin != 'optional') && !rjsPaths[dep.fullName]) {
            gutil.log(e)
        }
    }

    return pathToModule;
}

function addRoot (root) {
    return function (p) {
        return root ? path.join(root, p) : p;
    }
}

function hasValue (arr, val) {
    return arr.indexOf(val) !== -1;
}

function getDependencies(opts, deps) {
    let plugins = [];
    deps = (deps && deps instanceof Array) ? deps : [];
    deps = deps
        .map(function getValue(i) {
            if (!i || i.type !== 'Literal') {
                gutil.log('Warning! Dependencies is not literal. %s. %s', opts.file.path, JSON.stringify(i));
                return '';
            }
            return i.value;
        })
        .map(getMeta)
        .filter(whitelistedPlugin)
        .filter(notRemoteFile)
        .filter(notSystemModule)
        .map(replaceFirstDot);

    deps.forEach(function collectPlugins (i) {
        i.plugin && !hasValue(plugins, i.plugin) && needPlugin(i) ? plugins.push(i.plugin) : false;

        if (i.plugin == 'is') {
            let yesPlugin = i.moduleYes && i.moduleYes.plugin;
            let noPlugin = i.moduleNo && i.moduleNo.plugin;
            yesPlugin && !hasValue(plugins, yesPlugin) && needPlugin(i.moduleYes) && plugins.push(yesPlugin);
            noPlugin && !hasValue(plugins, noPlugin) && needPlugin(i.moduleNo) && plugins.push(noPlugin);
        } else if (i.plugin == 'browser' || i.plugin == 'optional') {
            let inPlugin = i.moduleIn && i.moduleIn.plugin;
            inPlugin && !hasValue(plugins, inPlugin) && needPlugin(i.moduleIn) && plugins.push(inPlugin);
        }
    });

    deps = deps.filter(function (i) {
        if (i.plugin == 'is') {
            let yesPlugin = i.moduleYes && i.moduleYes.plugin;
            let noPlugin = i.moduleNo && i.moduleNo.plugin;
            return !hasValue(pluginsOnlyDeps, yesPlugin) && !hasValue(pluginsOnlyDeps, noPlugin);
        } else if (i.plugin == 'browser' || i.plugin == 'optional') {
            let inPlugin = i.moduleIn && i.moduleIn.plugin;
            return !hasValue(pluginsOnlyDeps, inPlugin);
        } else {
            return !hasValue(pluginsOnlyDeps, i.plugin);
        }
    });

    //формируем объект зависимости для плагина и вставляем в начало массива зависимостей
    plugins.map(function (name) {
        return {
            fullName: name,
            amd: true
        }
    }).forEach(function pushPluginsDependencies(plugin) {
        deps.unshift(plugin);
    });
    return deps;
}

function needPlugin(meta) {
    if (meta.plugin == 'js') {
        // Проверим на пути requirejs
        let firstFolder = meta.module && meta.module.split('/')[0];
        if (firstFolder && rjsPaths[firstFolder]) {
            return false;
        }
    }

    return true;
}

function notRemoteFile (meta) {
    if (meta.plugin == 'is') {
        return (meta.moduleYes ? !reIsRemote.test(meta.moduleYes.module) : true) &&
            (meta.moduleNo ? !reIsRemote.test(meta.moduleNo.module) : true);
    }
    if (meta.plugin == 'browser' || meta.plugin == 'optional') {
        return meta.moduleIn ? !reIsRemote.test(meta.moduleIn.module) : true;
    }
    return meta.module && !reIsRemote.test(meta.module);
}

function notSystemModule (meta) {
    return meta.module && !hasValue(systemModules, meta.module);
}

function replaceFirstDot (meta) {
    meta.fullName = meta.fullName.replace(/^\.\/|\.\\\\/, '');
    return meta;
}

function whitelistedPlugin (meta) {
    if (meta.plugin == 'is') {
        return (meta.moduleYes ? hasValue(supportedPlugins, meta.moduleYes.plugin) : true) &&
            (meta.moduleNo ? hasValue(supportedPlugins, meta.moduleNo.plugin) : true);
    }
    if (meta.plugin == 'browser' || meta.plugin == 'optional') {
        return meta.moduleIn ? hasValue(supportedPlugins, meta.moduleIn.plugin) : true;
    }
    return hasValue(supportedPlugins, meta.plugin);
}

function merge(obj1, obj2) {
    let result = {};
    Object.keys(obj1).forEach(function (name) {
        result[name] = path.normalize(obj1[name]);
    });

    Object.keys(obj2).forEach(function (name) {
        result[name] = result[name] || path.normalize(obj2[name]);
    });

    return result;
}