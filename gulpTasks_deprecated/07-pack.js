const fs             = require('fs');
const path           = require('path');
const through2       = require('through2');
const gutil          = require('gulp-util');
const PluginError    = gutil.PluginError;
const VFile          = require('vinyl');
const minimatch      = require('minimatch');
const argv           = require('yargs').argv;
const assign         = require('object-assign');
const loaders        = require('./loaders');

const translit       = require('../lib/utils/transliterate');
const getMeta        = require('grunt-wsmod-packer/lib/getDependencyMeta.js');
const commonPackage  = require('grunt-wsmod-packer/lib/commonPackage.js');
// const customPackage  = require('grunt-wsmod-packer/tasks/lib/customPackage.js');
const packInOrder   = require('grunt-wsmod-packer/tasks/lib/packInOrder.js');
const domHelpers    = require('grunt-wsmod-packer/lib/domHelpers.js'); // FIXME: :)))
const packCSS       = require('grunt-wsmod-packer/tasks/lib/packCSS').gruntPackCSS;
const cssHelpers    = require('grunt-wsmod-packer/lib/cssHelpers');
const dom           = require('tensor-xmldom');
const domParser     = new dom.DOMParser();

let cache                        = {};
    cache[argv.application]      = {};
let configTemp                   = {};
    configTemp[argv.application] = {};

var complexControls = {
    TemplatedArea: {
        //наймспейс, в котором располагается класс
        'namespace': '$ws.proto.TemplatedAreaAbstract',
        //функция получения списка возможных шаблонов из опций комопнента
        'getTemplates': function (cfg) {
            var templates = [];
            if (cfg.template) {
                templates.push(cfg.template);
            }

            if (cfg.expectedTemplates && cfg.expectedTemplates.length) {
                templates = templates.concat(cfg.expectedTemplates);
            }
            return templates;
        }
    },
    Tabs: {
        'namespace': '$ws.proto.Tabs',
        'getTemplates': function (cfg) {
            var templates = [];
            if (cfg.tabs) {
                cfg.tabs.forEach(function (t) {
                    if (t && t.template) {
                        templates.push(t.template)
                    }
                });
            }
            return templates;
        }
    }
};

let packageHome = path.join(argv.root, argv.application, 'resources/packer/modules');

let __STATIC__        = [];
let __packages__      = [];
let __packwsmod__     = [];
// let __packjs__        = [];
// let __packcss__       = [];
let __packjscss__     = [];


module.exports = opts => {
    opts = assign({}, {
        acc: null
    }, opts);

    return through2.obj(
        function (file, enc, cb) {
            if (file.isStream()) return cb(new PluginError('gulp-sbis-packwsmod', 'Streaming not supported'));
            if (!opts.acc) return cb(new PluginError('gulp-sbis-packwsmod', 'acc option is required'));

            if (file.__MANIFEST__) return cb(null, file);

            if (file.sourceMap) opts.sourcemap = true;

            if (!file.dest) {
                file.dest = file.__WS ? path.join(argv.root, argv.application, 'ws', file.relative) : path.join(argv.root, argv.application,  'resources', translit(file.relative));
            }

            let ext = path.extname(path.basename(file.path));
            if ((ext == '.css' || ext == '.js') || file.__TMPL__) {
                __packjscss__.push({
                    base: file.base + '',
                    path: file.path + '',
                    dest: file.dest + '',
                    contents: Buffer.from(file.contents + ''),
                    __WS: file.__WS || false,
                    __TMPL__: file.__TMPL__ || false
                });

                __packwsmod__.push({
                    base: file.base + '',
                    path: file.path + '',
                    dest: file.dest + '',
                    contents: Buffer.from(file.contents + ''),
                    __WS: file.__WS || false,
                    __TMPL__: file.__TMPL__ || false
                });
            }

            if (file.__STATIC__) {
                if (!file.dest in opts.acc.packwsmod) opts.acc.packwsmod[file.dest] = {};
                if (!file.dest in opts.acc.packjscss) opts.acc.packjscss[file.dest] = {};

                __STATIC__.push({
                    base: file.base + '',
                    path: file.path + '',
                    dest: file.dest,
                    contents: Buffer.from(file.contents + ''),
                    __STATIC__: true
                });

            }

            return cb(null, file);
        },
        function (cb) {
            if (!global.__STATIC__done) return cb();

            const ctx       = this;
            let prog        = 0;
            let promises    = [];

            if (!__packwsmod__.length && !__STATIC__.length) return cb();
            let xmlContents = opts.acc.contents.xmlContents;
            for (let k in xmlContents) {
                cache[argv.application][k]       = [];
                configTemp[argv.application][k]  = [];
                let fileContent = fs.readFileSync(path.join(argv.root/*, argv.application*/, 'resources', xmlContents[k] + '.xml'));
                let resDom      = domParser.parseFromString(fileContent.toString(), 'text/html');
                let divs        = resDom.getElementsByTagName('div');
                for (var i = 0, l = divs.length; i < l; i++) {
                    let div = divs[i];
                    if (div.getAttribute('wsControl') == 'true') {
                        let configAttr = div.getElementsByTagName('configuration')[0];
                        if (configAttr) {
                            let typename = global.requirejs('Deprecated/ClassMapper').getClassMapping(div.getAttribute('type'));
                            promises.push(_resolveType({
                                typename: typename,
                                k: k,
                                configAttr: configAttr
                            }));
                        }
                    }
                }
            }

            let need2bundle = {};
            
            for (let i = 0, l = __STATIC__.length; i < l; i++) {
                need2bundle[__STATIC__[i].dest] = true;
            }
            mainLoop1:
            for (let i = 0, l = __packjscss__.length; i < l; i++) {
                let ext = path.extname(__packjscss__[i].path).substring(1); // 'css' 'js'
                for (let staticPath in opts.acc.packjscss) {
                    if (need2bundle[staticPath]) continue mainLoop1;
                    if (!Array.isArray(opts.acc.packjscss[staticPath][ext])) opts.acc.packjscss[staticPath][ext] = [];
                    for (let ii = 0, ll = opts.acc.packjscss[staticPath][ext].length; ii < ll; ii++) {
                        let filePath = opts.acc.packjscss[staticPath][ext][ii];
                        if (__packjscss__[i].dest.replace(/[\\]/g, '/') == filePath.replace(/[\\]/g, '/')) {
                            need2bundle[staticPath] = true;
                            continue mainLoop1;
                        }
                    }
                }
            }

            mainLoop2:
            for (let i = 0, l = __packwsmod__.length; i < l; i++) {
                let ext = path.extname(__packwsmod__[i].path).substring(1);
                for (let staticPath in opts.acc.packwsmod) {
                    if (need2bundle[staticPath]) continue mainLoop2;
                    for (let ii = 0, ll = opts.acc.packwsmod[staticPath][ext].length; ii < ll; ii++) {
                        let moduleMeta = opts.acc.packwsmod[staticPath][ext][ii];
                        if (!__packwsmod__[i].dest || __packwsmod__[i].dest == 'undefined') {
                            __packwsmod__[i].dest = path.join(argv.root, argv.application, 'ws', path.relative(__packwsmod__[i].base, __packwsmod__[i].path));
                        }
                        if (!moduleMeta.fullPath) continue;
                        if (__packwsmod__[i].dest.replace(/[\\]/g, '/').endsWith(moduleMeta.fullPath.replace(/[\\]/g, '/'))) {
                            need2bundle[staticPath] = true;
                            continue mainLoop2;
                        }
                    }
                }
            }



            Promise.all(promises)
                .then(result => {
                    let temp = Object.keys(configTemp);
                    prog = 0;
                    temp.forEach(function (service) {
                        var svcContainers = configTemp[service];
                        Object.keys(configTemp[service]).forEach(function (resource) {
                            _addTemplateDependencies(service, resource, svcContainers);
                        });

                    });

                    if (!opts.acc.packwsmodXML) opts.acc.packwsmodXML = {};
                    opts.acc.packwsmodXML.cache      = cache;
                    opts.acc.packwsmodXML.configTemp = configTemp;
                    let packwsmodJSON = new VFile({
                        base: path.join(argv.root, argv.application, 'resources'),
                        path: path.join(argv.root, argv.application, 'resources', 'packwsmod.json'),
                        contents: new Buffer(JSON.stringify(opts.acc.packwsmodXML))
                    });
                    packwsmodJSON.__MANIFEST__ = true;
                    ctx.push(packwsmodJSON);
                    // opts.acc.parsepackwsmod = false;
                })
                .then(() => {
                    // FIXME: здесб должна быть проверка не только статик-файлов, а в каких пакетах находиться этот файл и к какому статику он относится
                    return Promise.all(Object.keys(need2bundle).map(dest => {
                        return packwsmod({
                            contents: opts.acc.packwsmodContents[dest],
                            dest: dest,
                            __STATIC__: true
                        }, opts);
                    })).then(staticFiles => {
                        staticFiles.forEach(sFile => {

                            fs.writeFileSync(sFile.dest, sFile.contents + '');
                            // ctx.push(new VFile(sFile));
                            // packjs
                            function packerJS(htmlDest, files) {
                                return [files.map(function (js) {
                                    let ext = path.extname(js).substring(1); // 'js'
                                    if (!opts.acc.packjscss[htmlDest]) opts.acc.packjscss[htmlDest] = {};
                                    if (!opts.acc.packjscss[htmlDest][ext]) opts.acc.packjscss[htmlDest][ext] = [];
                                    opts.acc.packjscss[htmlDest][ext].push(js);
                                    return fs.readFileSync(js);
                                }).join(';\n')];
                            }

                            function packerCSS(htmlDest, files, root) {
                                return cssHelpers.splitIntoBatches(4000, cssHelpers.bumpImportsUp(files.map(function (css) {
                                    let ext = path.extname(css).substring(1); // 'js'
                                    if (!opts.acc.packjscss[htmlDest]) opts.acc.packjscss[htmlDest] = {};
                                    if (!opts.acc.packjscss[htmlDest][ext]) opts.acc.packjscss[htmlDest][ext] = [];
                                    opts.acc.packjscss[htmlDest][ext].push(css);
                                    return cssHelpers.rebaseUrls(root, css, fs.readFileSync(css));
                                }).join('\n')));
                            }

                            let packageHome = path.join(argv.root, argv.application, 'resources/packer/js');

                            domHelpers.package([sFile.dest], argv.root, packageHome, collectorJS, packerJS.bind(this, sFile.dest), nodeProducerJS, 'js');

                            packageHome = path.join(argv.root, argv.application, 'resources/packer/css');
                            domHelpers.package([sFile.dest], argv.root, packageHome, collectorCSS, packerCSS.bind(this, sFile.dest), getTargetNodeCSS, 'css');

                        });
                        __packages__.forEach(pFile => {
                            ctx.push(new VFile(pFile))
                        });
                    });
                })
                .then(() => {
                    // packowndeps
                    return new Promise((resolve, reject) => {
                        let jsFilesDest = __packjscss__.filter(f => f.path.endsWith('.js')).map(v => v.dest);
                        packOwnDeps(opts.acc.graph, jsFilesDest, resolve);
                    });

                })
                .then(() => {
                    if (!global.__DEV__) {
                        let configsArray = [];

                        for (let k in opts.acc.custompack) {
                            let packageName = path.basename(k);
                            let cfgContent  = JSON.parse(opts.acc.custompack[k]);
                            if (cfgContent instanceof Array) {
                                for (var i = 0; i < cfgContent.length; i++) {
                                    let cfgObj          = cfgContent[i];
                                    cfgObj.packageName  = packageName;
                                    cfgObj.configNum    = i + 1;
                                    configsArray.push(cfgObj);
                                }
                            } else {
                                cfgContent.packageName = packageName;
                                configsArray.push(cfgContent)
                            }
                        }

                        return Promise.all(configsArray.map(custompack.bind(this, opts.acc.graph)))
                    } else {
                        return true;
                    }
                })
                .then(() => {
                    let packwsmodJSON = new VFile({
                        base: path.join(argv.root, argv.application, 'resources'),
                        path: path.join(argv.root, argv.application, 'resources', 'packwsmod.json'),
                        contents: new Buffer(JSON.stringify(opts.acc.packwsmod))
                    });

                    let packjscssJSON = new VFile({
                        base: path.join(argv.root, argv.application, 'resources'),
                        path: path.join(argv.root, argv.application, 'resources', 'packjscss.json'),
                        contents: new Buffer(JSON.stringify(opts.acc.packjscss))
                    });

                    packwsmodJSON.__MANIFEST__ = true;
                    packjscssJSON.__MANIFEST__ = true;
                    ctx.push(packwsmodJSON);
                    ctx.push(packjscssJSON);
                    cb();
                });

        }
    )
};
// const packer = require('./packer');
// var commonPackage = require('grunt-wsmod-packer/lib/commonPackage.js');

function custompack (dg, cfg) {
    const applicationRoot   = path.join(argv.root, argv.application);
    let orderQueue          = getOrderQueue(dg, cfg, applicationRoot);

    // Не будем портить оригинальный файл.
    let outputFile = getOutputFile(cfg.output, applicationRoot, dg);
    let promises = [];

    if (fs.existsSync(outputFile) && !fs.existsSync(originalPath(outputFile))) {
        fs.writeFileSync(originalPath(outputFile), fs.readFileSync(outputFile));
        let loadedDependencies = [];
        if (orderQueue && orderQueue.length) {
            for (let ii = 0, ll = orderQueue.length; ii < ll; ii++) {
                let dep = orderQueue[ii];
                if (dep.plugin == 'tmpl') continue;
                loadedDependencies.push(loaders[dep.plugin](dep, argv.root));
            }
            promises.push(Promise.all(loadedDependencies)
                .then(function (outputFile, data) {
                    try {
                        fs.writeFileSync(
                            outputFile,
                            data.reduce((res, modContent) => res + (res ? '\n' : '') + modContent, '')
                        );
                    } catch (err) {
                        console.error(err);
                    }

                    return outputFile;
                }.bind(this, outputFile)))
        }

    }
    if (!promises.length) return Promise.resolve();
    return Promise.all(promises);
}

function getOrderQueue(dg, cfg, applicationRoot) {
    var modules = findAllModules(dg, cfg.modules);
    var include = generateRegExp(cfg.include);
    var exclude = generateRegExp(cfg.exclude);

    var orderQueue = dg.getLoadOrder(modules);

    return commonPackage.prepareOrderQueue(dg, orderQueue, applicationRoot)
        .filter(function (module) {
            return include ? include.test(module.fullName) : true;
        })
        .filter(function (module) {
            return exclude ? !exclude.test(module.fullName) : true;
        });
}

function findAllModules(dg, modules) {
    var nodes = dg.getNodes();
    var regexp = generateRegExp(modules);

    return nodes.filter(function (node) {
        return regexp.test(node);
    });
}

function generateRegExp(modules) {
    var regexpStr = '';

    if (!modules || !modules.length) {
        return null;
    }

    modules.forEach(function (module) {
        if (typeof module !== 'string') return;

        if (module.indexOf('*') > -1) {
            regexpStr += (regexpStr ? '|' : '') + '(' + escapeRegExpWithoutAsterisk(module) + ')';
        } else {
            regexpStr += (regexpStr ? '|' : '') + '(' + escapeRegExp(module) + '$)';
        }
    });

    return new RegExp(regexpStr);
}

function escapeRegExpWithoutAsterisk(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g, "\\$&").replace('*', '.*');
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function originalPath(path) {
    return path.indexOf('.original.') > -1 ? path : path.replace(/(\.js)$/, '.original$1');
}

function getOutputFile(output, applicationRoot, dg) {
    let outputFile;

    if (output.indexOf('/resources') > -1) {
        outputFile = output;
    } else if (output.indexOf('js!') > -1) {
        outputFile = dg.getNodeMeta(output).path;
    }

    if (!outputFile) {
        throw new Error('Параметр output должен начинаться с /resources или быть именем модуля js!*. Текущий output: ' + output);
    }

    return path.join(applicationRoot, outputFile).replace(/\\/g, '/');
}

function packOwnDeps (dg, jsFilesDest, taskDone) {
    const applicationRoot   = path.join(argv.root, argv.application);
    let allModules          = getAllModules(dg, applicationRoot).filter(m => jsFilesDest.some(v => v == m.fullPath));
    let promises            = [];

    for (let i = 0, l = allModules.length; i < l; i++) {
        let item                = allModules[i];
        let loadedDependencies  = [];

        for (let ii = 0, ll = item.deps.length; ii < ll; ii++) {
            let dep = item.deps[ii];
            loadedDependencies.push(loaders[dep.plugin](dep, argv.root));
            // commonPackage.getLoader(dep.plugin)(dep, root, done);
        }

        promises.push(Promise.all(loadedDependencies)
            .then(function (item, data) {
                fs.writeFileSync(
                    item.tempPath,
                    data.reduce((res, modContent) => res + (res ? '\n' : '') + modContent, '')
                );
                return item;
            }.bind(this, item))
            .then(item => {
                fs.writeFileSync(item.fullPath.replace(/(\.js)$/, '.original$1'), fs.readFileSync(item.fullPath));
                fs.writeFileSync(item.fullPath, fs.readFileSync(item.tempPath));
                fs.unlinkSync(item.tempPath);
            }));
    }

    return Promise.all(promises).then(taskDone);
}


function getAllModules(dg) {
    const applicationRoot = path.join(argv.root, argv.application);

    return dg.getNodes()
        .map(getMeta)
        .filter(function onlyJS(node) {
            return node.plugin == 'js';
        })
        .map(function setFullPath(node) {
            node.fullPath = path.join(applicationRoot, dg.getNodeMeta(node.fullName).path);
            node.amd = dg.getNodeMeta(node.fullName).amd;
            return node;
        })
        .map(function setTempPath(node) {
            node.tempPath = node.fullPath.replace(/(?:\.module)?\.js$/, '.modulepack.js');
            return node;
        })
        .filter(function excludePacked(node) {
            return !fs.existsSync(node.tempPath);
        })
        .map(function getDependencies(node) {
            node.deps = dg.getDependenciesFor(node.fullName)
                .map(getMeta)
                .filter(function excludeEmptyDependencies(dep) {
                    var res = false;
                    if (dep.plugin == 'is') {
                        if (dep.moduleYes) {
                            res = dg.getNodeMeta(dep.moduleYes.fullName);
                        }
                        if (res && dep.moduleNo) {
                            res = dg.getNodeMeta(dep.moduleNo.fullName);
                        }
                    } else if ((dep.plugin == 'browser' || dep.plugin == 'optional') && dep.moduleIn) {
                        res = dg.getNodeMeta(dep.moduleIn.fullName);
                    } else {
                        res = dg.getNodeMeta(dep.fullName);
                    }
                    return res && res.path;
                })
                .filter(function excludeI18N(dep) {
                    return dep.plugin != 'i18n' && dep.plugin != 'css';
                })
                .filter(function excludeNonOwnDependencies(dep) {
                    var ownDeps = false;
                    if (dep.plugin == 'is') {
                        if (dep.moduleYes) {
                            ownDeps = (new RegExp('(.+!)?' + node.module + '($|\\\\|\\/)')).test(dep.moduleYes.fullName);
                        }
                        if (dep.moduleNo) {
                            ownDeps = (new RegExp('(.+!)?' + node.module + '($|\\\\|\\/)')).test(dep.moduleNo.fullName);
                        }
                    } else if ((dep.plugin == 'browser' || dep.plugin == 'optional') && dep.moduleIn) {
                        ownDeps = (new RegExp('(.+!)?' + node.module + '($|\\\\|\\/)')).test(dep.moduleIn.fullName);
                    } else {
                        ownDeps = (new RegExp('(.+!)?' + node.module + '($|\\\\|\\/)')).test(dep.fullName);
                    }
                    return ownDeps;
                })
                .map(function setFullPath(dep) {
                    if (dep.plugin == 'is') {
                        if (dep.moduleYes) {
                            dep.moduleYes.fullPath = path.join(applicationRoot, dg.getNodeMeta(dep.moduleYes.fullName).path);
                            dep.moduleYes.amd = dg.getNodeMeta(dep.moduleYes.fullName).amd;
                        }
                        if (dep.moduleNo) {
                            dep.moduleNo.fullPath = path.join(applicationRoot, dg.getNodeMeta(dep.moduleNo.fullName).path);
                            dep.moduleNo.amd = dg.getNodeMeta(dep.moduleNo.fullName).amd;
                        }
                    } else if ((dep.plugin == 'browser' || dep.plugin == 'optional') && dep.moduleIn) {
                        dep.moduleIn.fullPath = path.join(applicationRoot, dg.getNodeMeta(dep.moduleIn.fullName).path);
                        dep.moduleIn.amd = dg.getNodeMeta(dep.moduleIn.fullName).amd;
                    } else {
                        dep.fullPath = path.join(applicationRoot, dg.getNodeMeta(dep.fullName).path);
                        dep.amd = dg.getNodeMeta(dep.fullName).amd;
                    }
                    return dep;
                })
                // Add self
                .concat(node);
            return node;
        })
        .filter(function withDependencies(node) {
            return node.deps.length > 1;
        });
}

// PACKCSS

function collectorCSS(dom) {
    var links = dom.getElementsByTagName('link'),
        files = [],
        elements = [],
        before, link, href, packName, rel, media;
    for (var i = 0, l = links.length; i < l; i++) {
        link = links[i];
        packName = link.getAttribute('data-pack-name');

        // data-pack-name='skip' == skip this css from packing
        if (packName == 'skip')
            continue;

        href = links[i].getAttribute('href');
        rel = links[i].getAttribute('rel');
        media = links[i].getAttribute('media') || 'screen';

        // stylesheet, has href ends with .css and not starts with http or //, media is screen
        if (href && rel == 'stylesheet' && media == 'screen' &&
            href.indexOf('http') !== 0 &&
            href.indexOf('//') !== 0 &&
            href.indexOf('.css') !== href.length - 3) {
            files.push(href);
            elements.push(link);
            before = link.nextSibling;
        }
    }

    return [{
        files: files,
        nodes: elements,
        before: before
    }];
}



function getTargetNodeCSS(dom, path) {
    return domHelpers.mkDomNode(dom, 'link', {
        rel: 'stylesheet',
        href: '/' + path.replace(/\\/g, '/')
    });
}

// PACKCSS END

// PACKJS
function collectorJS(dom) {
    var defId = 0,
        scripts = dom.getElementsByTagName('script'),
        packs = {},
        script, link, packName, pack, lastPackName, type;

    for (var i = 0, l = scripts.length; i < l; i++) {
        script = scripts[i];
        packName = script.getAttribute('data-pack-name') || "unset";
        type = script.getAttribute('type') || 'text/javascript';
        link = script.getAttribute('src');

        // inline script will split package
        // type other than text/javascript will split package
        // data-pack-name='skip' == skip this script from packing, ignore it at all, don't split package
        if (!link || type !== 'text/javascript' || packName == 'skip') {
            defId++;
            continue;
        }

        if (lastPackName && lastPackName != packName) {
            defId++;
        }

        lastPackName = packName;
        packName = packName + defId;

        // ends with .js and not starts with http and not starts with // (schema-less urls)
        if (link.indexOf('.js') == link.length - 3 &&
            link.indexOf('http') !== 0 &&
            link.indexOf('//') !== 0) {

            pack = packs[packName] || (packs[packName] = {
                    files: [],
                    nodes: [],
                    before: null
                });

            pack.files.push(link);
            pack.nodes.push(script);
            pack.before = script.nextSibling;
        } else {
            // any other script will split package
            defId++;
        }
    }

    return Object.keys(packs).map(function (k) {
        return packs[k];
    });
}



function nodeProducerJS(dom, path) {
    var script = domHelpers.mkDomNode(dom, 'script', {
        type: 'text/javascript',
        charset: 'utf-8',
        src: '/' + path.replace(/\\/g, '/')
    });
    script.textContent = " ";
    return script;
}

// end of PACKJS


function packwsmod (file, opts) {
    return new Promise((resolve, reject) => {
        if (file.__STATIC__) {
            var dom = domParser.parseFromString(file.contents + ''),
                divs = dom.getElementsByTagName('div'),
                jsTarget = dom.getElementById('ws-include-components'),
                cssTarget = dom.getElementById('ws-include-css'),
                htmlPath = file.dest.split('/'),
                htmlName = htmlPath[htmlPath.length-1];

            var themeNameFromDOM = domHelpers.resolveThemeByWsConfig(dom);

            if (jsTarget || cssTarget) {
                let startNodes = getStartNodes(divs, argv.application);

            let orderQueue = opts.acc.graph.getLoadOrder(startNodes)
                    .filter(dep => {
                        return dep.path ? !/\/?cdn\//.test(dep.path.replace(/\\/g, '/')) : true;
                    })
                    .map(dep => {
                        let meta = getMeta(dep.module);
                        if (meta.plugin == 'is') {
                            if (meta.moduleYes) {
                                meta.moduleYes.fullPath = opts.acc.getFilePathByRelativeDest(opts.acc.graph.getNodeMeta(meta.moduleYes.fullName).path) || '';
                                meta.moduleYes.amd = opts.acc.graph.getNodeMeta(meta.moduleYes.fullName).amd;
                            }
                            if (meta.moduleNo) {
                                meta.moduleNo.fullPath = opts.acc.getFilePathByRelativeDest(opts.acc.graph.getNodeMeta(meta.moduleNo.fullName).path) || '';
                                meta.moduleNo.amd = opts.acc.graph.getNodeMeta(meta.moduleNo.fullName).amd;
                            }
                        } else if ((meta.plugin == 'browser' || meta.plugin == 'optional') && meta.moduleIn) {
                            meta.moduleIn.fullPath = opts.acc.getFilePathByRelativeDest(opts.acc.graph.getNodeMeta(meta.moduleIn.fullName).path) || '';
                            meta.moduleIn.amd = opts.acc.graph.getNodeMeta(meta.moduleIn.fullName).amd;
                        } else if (meta.plugin == 'i18n') {
                            meta.fullPath = opts.acc.getFilePathByRelativeDest(opts.acc.graph.getNodeMeta(meta.fullName).path) || dep.path || '';
                            meta.amd = opts.acc.graph.getNodeMeta(meta.fullName).amd;
                            meta.deps = opts.acc.graph.getDependenciesFor(meta.fullName);
                        } else {
                            meta.fullPath = opts.acc.getFilePathByRelativeDest(opts.acc.graph.getNodeMeta(meta.fullName).path) || dep.path || '';
                            meta.amd = opts.acc.graph.getNodeMeta(meta.fullName).amd;
                        }

                        return meta;
                    })
                    .filter(module => {
                        if (module.plugin == 'is') {
                            if (module.moduleYes && !module.moduleYes.fullPath) {
                                console.log('Empty file name: ' + module.moduleYes.fullName);
                                return false;
                            }
                            if (module.moduleNo && !module.moduleNo.fullPath) {
                                console.log('Empty file name: ' + module.moduleNo.fullName);
                                return false;
                            }
                        } else if (module.plugin == 'browser' || module.plugin == 'optional') {
                            if (module.moduleIn && !module.moduleIn.fullPath) {
                                console.log('Empty file name: ' + module.moduleIn.fullName);
                                return false;
                            }
                        } else if (!module.fullPath) {
                            console.log('Empty file name: ' + module.fullName);
                            return false;
                        }
                        return true;
                    })
                    .map(module => {
                        if (module.plugin == 'is') {
                            if (module.moduleYes) {
                                module.moduleYes.fullPath = opts.acc.getFilePathByRelativeDest(module.moduleYes.fullPath);
                            }
                            if (module.moduleNo) {
                                module.moduleNo.fullPath = opts.acc.getFilePathByRelativeDest(module.moduleNo.fullPath);
                            }
                        } else if ((module.plugin == 'browser' || module.plugin == 'optional') && module.moduleIn) {
                            module.moduleIn.fullPath = opts.acc.getFilePathByRelativeDest(module.moduleIn.fullPath);
                        } else {
                            module.fullPath = opts.acc.getFilePathByRelativeDest(module.fullPath);
                        }
                        return module;
                    })
                    .reduce(function (memo, module) {
                        if (module.plugin == 'is') {
                            if (!memo.paths[module.moduleYes.fullPath]) {
                                if (module.moduleYes && module.moduleYes.plugin == 'css') {
                                    memo.css.push(module.moduleYes);
                                } else {
                                    memo.js.push(module);
                                }
                                module.moduleYes && (memo.paths[module.moduleYes.fullPath] = true);
                                module.moduleNo && (memo.paths[module.moduleNo.fullPath] = true);
                            }
                        } else if (module.plugin == 'browser' || module.plugin == 'optional') {
                            if (!memo.paths[module.moduleIn.fullPath]) {
                                if (module.moduleIn && module.moduleIn.plugin == 'css') {
                                    memo.css.push(module.moduleIn);
                                } else {
                                    memo.js.push(module);
                                }
                                module.moduleIn && (memo.paths[module.moduleIn.fullPath] = true);
                            }
                        } else {
                            if (!memo.paths[module.fullPath]) {
                                if (module.plugin == 'css') {
                                    memo.css.push(module);
                                } else {
                                    var matchLangArray = module.fullName.match(/lang\/([a-z]{2}-[A-Z]{2})/);
                                    if (matchLangArray !== null && (module.plugin == 'text' || module.plugin == 'js')) {
                                        var locale = matchLangArray[1];
                                        (memo.dict[locale] ? memo.dict[locale]: memo.dict[locale] = []).push(module);
                                        //в итоге получится memo.dict = {'en-US': [modules], 'ru-RU': [modules], ...}
                                    }
                                    else if (matchLangArray !== null && (module.plugin === 'native-css')) {
                                        var locale = matchLangArray[1];
                                        (memo.cssForLocale[locale] ? memo.cssForLocale[locale]: memo.cssForLocale[locale] = []).push(module);
                                        //в итоге получится memo.cssForLocale = {'en-US': [modules], 'ru-RU': [modules], ...} только теперь для css-ок
                                    }
                                    else {
                                        memo.js.push(module);
                                    }
                                }
                                memo.paths[module.fullPath] = true;
                            }
                        }
                        return memo;
                    }, {css: [], js: [], dict:{}, cssForLocale:{}, paths: {}});

                opts.acc.packwsmod[file.dest] = orderQueue;
                // packer(orderQueue, argv.root, false, () => {}, null, htmlName, themeNameFromDOM);
                packInOrder(opts.acc.graph, startNodes, argv.root, path.join(argv.root, argv.application), false, function (err, filesToPack) {
                    if (err) {
                        gutil.log('\nОШИБКА:');
                        gutil.log(err);
                        resolve();
                    } else {
                        filesToPack.js  = generatePackage(filesToPack, 'js', packageHome, root);
                        filesToPack.css = generatePackage(filesToPack, 'css', packageHome, root);

                        insertAllDependenciesToDocument(filesToPack, 'js', jsTarget);
                        insertAllDependenciesToDocument(filesToPack, 'css', cssTarget);

                        // fs.writeFileSync(htmlFile, domHelpers.stringify(dom));
                        resolve({
                            contents: Buffer.from(domHelpers.stringify(dom)),
                            base: path.join(argv.root, argv.application),
                            path: file.dest,
                            dest: file.dest,
                            __STATIC__: true
                        });
                    }
                }, null, htmlName, themeNameFromDOM);
            }
        }
    });
}
function getDeps (application, template) {
    return cache[argv.application] && cache[argv.application][template] || [];
}
module.exports.getDeps = getDeps;

function _resolveType (args) {
    let typename    = args.typename;
    let res         = args.k;
    let configAttr  = args.configAttr;

    return resolveType(typename/*, configAttr*/).then(classCtor => {
        var config = parseConfiguration(configAttr, false);
        var baseConfig = resolveOptions(classCtor);
        let coreMerge = global.requirejs('Core/core-merge');
        var finalConfig = coreMerge(baseConfig, config[0]);

        if (isComplexControl(classCtor)) {
            configTemp[argv.application][res].push({
                'ctor': classCtor,
                'cfg': finalConfig
            });
        }
        _addDependency(cache[argv.application][res], typename, finalConfig);
    })
}
function resolveOptions(ctor) {
    if (ctor) {
        let coreMerge = global.requirejs('Core/core-merge');
        return coreMerge(
            resolveOptions(ctor.superclass && ctor.superclass.$constructor),
            ctor.prototype.$protected && ctor.prototype.$protected._options || {},
            { clone: true });
    } else {
        return {};
    }
}
function isComplexControl(classCtor) {
    var res = false;
    for (var i in complexControls) {
        if (complexControls.hasOwnProperty(i)) {
            complexControls[i].class = complexControls[i].class || _getConstructor(complexControls[i].namespace);
            if (_isSubclass(classCtor, complexControls[i].class)) {
                res = true;
                break;
            }
        }
    }
    return res;
}
function _getConstructor(namespace) {
    var path,
        paths = namespace.split('.'),
        result = (function () {
            return this || (0, eval)('this');
        }());

    while (path = paths.shift()) {
        result = result[path];
        if (!result) {
            break;
        }
    }
    return result;
}
function parseConfiguration(configRoot, makeArray, parseStack) {
    var name, value, type, hasValue,
        functionsPaths = [],
        // Это место переписано так не случайно. От старого вариант почему-то ВНЕЗАПНО ломался каверидж
        retvalFnc = function () {
            var self = this;
            self.mass = makeArray ? [] : {};
            self.push = function (name, value) {
                if (makeArray) {
                    self.mass.push(value);
                } else if (name !== null) {
                    self.mass[name] = value;
                }
            }
        },
        retval = new retvalFnc();

    parseStack = parseStack || [];

    if (configRoot && configRoot.childNodes) {
        var children = configRoot.childNodes;
        var pos = -1;
        for (var i = 0, l = children.length; i < l; i++) {
            var child = children[i];
            if (child.nodeName && child.nodeName == 'option') {
                pos++;
                name = child.getAttribute('name');
                type = child.getAttribute('type');
                value = child.getAttribute('value');
                hasValue = child.hasAttribute('value');

                parseStack.push(name || pos);

                //if (type === 'array' || name === null || value === null){
                if (type === 'array' || (!hasValue && type != 'cdata')) {
                    //Если не в листе дерева, то разбираем дальше рекурсивно
                    if (!hasValue) {
                        var r = parseConfiguration(child, type === 'array', parseStack);
                        value = r[0];
                        functionsPaths.push.apply(functionsPaths, r[1]);
                    }

                    retval.push(name, value);
                }
                //добрались до листа дерева
                else {
                    switch (type) {
                        case 'cdata':
                            retval.push(name, findCDATA(child, true));
                            break;
                        case 'boolean':
                            retval.push(name, value === "true");
                            break;
                        case 'function':
                        case 'moduleFunc':
                        case 'dialog':
                        case 'command':
                        case 'newpage':
                        case 'page':
                        case 'menu':
                            if (typeof(value) === 'string' && value.length > 0) {
                                functionsPaths.push(parseStack.join('/'));
                                retval.push(name, type + "#" + value);
                            }
                            break;
                        case null:
                        default :
                            if (value === "null") {
                                value = null;
                            }
                            retval.push(name, value);
                            break;
                    }
                }
                parseStack.pop();
            }
        }
    }
    return [retval.mass, functionsPaths];
}

function insertAllDependenciesToDocument(filesToPack, type, insertAfter) {
    var type2attr = {
        'js': 'src',
        'css': 'href'
    }, type2node = {
        'js': 'script',
        'css': 'link'
    }, type2type = {
        'js': 'text/javascript',
        'css': 'text/css'
    }, options = {
        'data-pack-name': 'ws-mods-' + type,
        'type': type2type[type]
    };

    if (insertAfter && filesToPack && filesToPack[type]) {
        filesToPack = filesToPack[type];

        if (filesToPack.length && type in type2attr) {
            if (type == 'css') {
                options.rel = 'stylesheet';
            }

            filesToPack.reverse().forEach(function (file) {
                var newTarget;
                options[type2attr[type]] = '/' + file.replace(/\\/g, '/');
                newTarget = domHelpers.mkDomNode(insertAfter.ownerDocument, type2node[type], options);
                insertAfter.parentNode.insertBefore(newTarget, insertAfter.nextSibling);
            });
        }
    }
}

function generatePackage(filesToPack, ext, packageTarget, siteRoot) {
    filesToPack = filesToPack[ext];

    if (filesToPack) {
        if (typeof filesToPack === 'string') {
            filesToPack = [filesToPack];
        }

        return filesToPack.map(function (file) {
            var packageName = domHelpers.uniqname(file, ext);
            var packedFileName = path.join(packageTarget, packageName);

            // #! this.push
            // grunt.file.write(packedFileName, file);
            __packages__.push({
                base: path.join(argv.root, argv.application, 'resources'),
                path: path.join(argv.root, argv.application, path.relative(argv.root, packedFileName)),
                contents: new Buffer(file + '')
            });
            // console.log('path.relative(argv.root, packedFileName) ==', path.relative(argv.root, packedFileName));

            return path.relative(argv.root, packedFileName);
        });
    } else {
        return '';
    }
}




function getStartNodes(divs, application) {
    var startNodes = [],
        div, tmplName;

    for (var i = 0, l = divs.length; i < l; i++) {
        div = divs[i];
        var divClass = div.getAttribute('class');
        if (divClass && divClass.indexOf('ws-root-template') > -1 && (tmplName = div.getAttribute('data-template-name'))) {
            gutil.log("Packing inner template '" + tmplName + "'");

            startNodes = startNodes.concat(getStartNodeByTemplate(tmplName, argv.application));
        }

        if (tmplName) {
            if (startNodes.length === 0) {
                gutil.log("No any dependencies collected for '" + tmplName + "'");
            } else {
                gutil.log("Got " + startNodes.length + " start nodes for '" + tmplName + "': " + startNodes.join(','));
            }
        }
    }

    // сделаем список стартовых вершни уникальным
    startNodes = startNodes.filter(function (el, idx, arr) {
        return arr.indexOf(el, idx + 1) == -1
    });

    return startNodes;
}

function getStartNodeByTemplate(templateName, application) {
    var startNodes = [],
        deps;
    // opts.acc.packwsmodXML.cache
    // Если шаблон - новый компонент, ...
    if (templateName.indexOf('js!') === 0) {
        // ... просто добавим его как стартовую ноду
        startNodes.push(templateName);
    } else {
        // Иначе получим зависимости для данного шаблона
        deps = getDeps(null, templateName);
        // дополним ранее собранные
        startNodes = startNodes.concat(deps
            .map(function (dep) {
                // старый или новый формат описания класса
                var clsPos = dep.indexOf(':');
                if (clsPos !== -1) {
                    // Control/Area:AreaAbstract например, возьмем указанное имя класса
                    return dep.substr(clsPos + 1);
                } else {
                    // Control/Grid например, возьмем последний компонент пути
                    return dep.split('/').pop();
                }
            })
            .map(function addNamespace(dep) {
                if (dep.indexOf('.') === -1) {
                    return 'js!SBIS3.CORE.' + dep;
                } else {
                    return 'js!' + dep;
                }
            }));
    }

    return startNodes;
}

function resolveType (type, configAttr) {
    var cP = type.indexOf(':'),
        className, moduleName;

    if (cP !== -1) {
        className = type.substring(cP + 1);
        type = type.substring(0, cP);
    }

    var p = type.split('/');
    if (cP === -1) {
        className = p[p.length - 1];
    }

    let _const = global.requirejs('Core/constants');
    if (className in _const.jsCoreModules || className in _const.jsModules) {
        moduleName = className;
    } else {
        moduleName = "SBIS3.CORE." + className;
    }

    return new Promise((resolve, reject) => {
        let moduleStubs = global.requirejs('Core/moduleStubs');
        moduleStubs.requireModule(moduleName).addCallbacks(function (modArray) {
            return resolve(modArray[0]);
        }, function (e) {
            e.message = "Don't know how to load " + type + ". Resolved class is " + className + ". Resolved module is " + moduleName + ". Original message: " + e.message +
                (e.requireType ? '. RequireType: ' + e.requireType : '') + (e.requireMap ? '. RequireMap: ' + JSON.stringify(e.requireMap, null, 2) : '') +
                (e.requireModules && e.requireModules.length ? '. RequireModules: ' + JSON.stringify(e.requireModules) : '') + '.\nError stack: ' + e.stack;
            return reject(e);
        });
    });
}

function _addTemplateDependencies(service, template, knownContainers) {

    function _processTemplate(t) {
        _addTemplateDependencies(service, t, knownContainers);
        (cache[service][t] || []).forEach(function (d) {
            _addDependency(cache[service][template], d);
        });
        if (cache[service][t] === undefined && t.indexOf('js!') === 0) {
            // Все равно добавим, считаем что у нас это компонент
            _addDependency(cache[service][template], t.substr(3));
        }
    }

    var containers = knownContainers[template];
    if (containers) {
        containers.forEach(function (ctr) {
            getExpectedTemplates(ctr).forEach(function (t) {
                _processTemplate(t);
            });
        });
    }

}

function _addDependency(store, dependency) {
    let ClassMapper = global.requirejs('Deprecated/ClassMapper');
    dependency = ClassMapper.getClassMapping(dependency);

    if (store.indexOf(dependency) == -1) {
        store.push(dependency);
    }
}

function _isSubclass(cls, sup) {
    if (sup) {
        return (function (c) {
            if (c == sup) {
                return true;
            } else {
                if (c && c.superclass && c.superclass.$constructor) {
                    return arguments.callee(c.superclass.$constructor);
                } else {
                    return false;
                }
            }
        })(cls);
    } else {
        return false;
    }
}

function getExpectedTemplates (obj) {
    for (var i in complexControls) {
        if (complexControls.hasOwnProperty(i) && _isSubclass(obj.ctor, complexControls[i].class)) {
            return complexControls[i].getTemplates(obj.cfg);
        }
    }
    return [];
}