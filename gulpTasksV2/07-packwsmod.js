// 'use strict';

const fs             = require('fs');
const path           = require('path');
const through2       = require('through2');
const gutil          = require('gulp-util');
const PluginError    = gutil.PluginError;
const minimatch      = require('minimatch');
const argv           = require('yargs').argv;
const assign         = require('object-assign');
// const translit       = require('../lib/utils/transliterate');
const applySourceMap = require('vinyl-sourcemaps-apply');
const packInOrder = require('grunt-wsmod-packer/tasks/lib/packInOrder.js');
var dom = require('tensor-xmldom');
var domParser = new dom.DOMParser();
const domHelpers = require('grunt-wsmod-packer/lib/domHelpers.js');

var cache = {};
var configTemp = {};
cache[argv.application] = {};
configTemp[argv.application] = {};

var grabFailedModule = /Original\smessage:\sModule\s([\w\.]+)\sis\snot\sdefined/;
var jsFilter = /^js!|^js$/;

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

// packageHome = path.join(applicationRoot, 'resources/packer/modules')

/*cfg.packwsmod.main = {
    root: root,
    application: application,
    src: '*.html',
    packages: 'resources/packer/modules'
};*/
// dg = modDeps.getDependencyGraph(applicationRoot);
// packHTML(grunt, dg, htmlFiles, packageHome, root, application, taskDone);
module.exports = opts => {
    opts = assign({}, {
        acc: null
    }, opts);

    return through2.obj(
        function (file, enc, cb) {
            if (file.isStream()) return cb(new PluginError('gulp-sbis-packwsmod', 'Streaming not supported'));
            if (!opts.acc) return cb(new PluginError('gulp-sbis-packwsmod', 'acc option is required'));
            // if (!file.__STATIC__) return cb(null, file);
            // if ('.html' !== path.extname(file.path)) return cb(null, file);
            if (file.sourceMap) opts.sourcemap = true;



            cb(null, file);
        },
        function (cb) {
            let prog = 0;
            let promises = [];

            let xmlContents = opts.acc.contents.xmlContents;
            for (let k in xmlContents) {
                cache[argv.application][k]       = [];
                configTemp[argv.application][k]  = [];
                let fileContent = fs.readFileSync(path.join(argv.root, argv.application, 'resources', xmlContents[k] + '.xml'));
                let resDom      = domParser.parseFromString(fileContent.toString(), 'text/html');
                let divs        = resDom.getElementsByTagName('div');
                for (var i = 0, l = divs.length; i < l; i++) {
                    let div = divs[i];
                    if (div.getAttribute('wsControl') == 'true') {
                        let configAttr = div.getElementsByTagName('configuration')[0];
                        if (configAttr) {
                            let typename = global.$ws.single.ClassMapper.getClassMapping(div.getAttribute('type'));
                            promises.push(_resolveType({
                                typename: typename,
                                k: k,
                                configAttr: configAttr
                            }));
                        }
                    }
                }
            }

            if (promises.length) {
                Promise.all(promises)
                    .then(result => {
                        var temp = Object.keys(configTemp);
                        prog = 0;
                        temp.forEach(function (service) {
                            var svcContainers = configTemp[service];
                            Object.keys(configTemp[service]).forEach(function (resource) {
                                _addTemplateDependencies(service, resource, svcContainers);
                            });

                        });

                        // packFiles(grunt, dg, htmlFileset, packageHome, root, application, taskDone);
                    })
            }
            cb();
        }
    )
};

module.exports.getDeps = function (application, template) {
    return cache[argv.application] && cache[argv.application][template] || [];
};

function _resolveType (args) {
    let typename = args.typename;
    let res = args.k;
    let configAttr = args.configAttr;

    return resolveType(typename/*, configAttr*/).then(classCtor => {
        var config = parseConfiguration(configAttr, false);
        var baseConfig = resolveOptions(classCtor);
        var finalConfig = global.$ws.core.merge(baseConfig, config[0]);

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
        return $ws.core.merge(
            resolveOptions(ctor.superclass && ctor.superclass.$constructor),
            ctor.prototype.$protected && ctor.prototype.$protected._options || {},
            {clone: true});
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

/*function packFiles (dg, htmlFileset, packageHome, root, application, taskDone) {
    gutil.log("Packing dependencies of " + htmlFileset.length + " files...");
    async.eachLimit(htmlFileset, 1, function (htmlFile, done) {
        try {

            var dom = domHelpers.domify(htmlFile),
                divs = dom.getElementsByTagName('div'),
                jsTarget = dom.getElementById('ws-include-components'),
                cssTarget = dom.getElementById('ws-include-css'),
                htmlPath = htmlFile.split('/'),
                htmlName = htmlPath[htmlPath.length-1];

            var themeNameFromDOM = domHelpers.resolveThemeByWsConfig(dom);
            if (jsTarget || cssTarget) {
                var startNodes = getStartNodes(divs, application);

                packInOrder(dg, startNodes, root, path.join(root, application), false, function (err, filesToPack) {
                    if (err) {
                        done(err);
                    } else {
                        filesToPack.js = generatePackage(grunt, filesToPack, 'js', packageHome, root);
                        filesToPack.css = generatePackage(grunt, filesToPack, 'css', packageHome, root);

                        // пропишем в HTML
                        insertAllDependenciesToDocument(filesToPack, 'js', jsTarget);
                        insertAllDependenciesToDocument(filesToPack, 'css', cssTarget);

                        grunt.file.write(htmlFile, domHelpers.stringify(dom));
                        done();
                    }
                }, null, htmlName, themeNameFromDOM);
            } else {
                grunt.log.debug("No any packing target in '" + htmlFile + "'");
                done();
            }
        } catch (err) {
            if (typeof err == 'string') {
                err = new Error(err);
            }
            grunt.fail.warn("ERROR! Failed to process '" + htmlFile + "'!\n" + err.message + "\n" + err.stack + "\n", ERROR_PACKING_FAILED);
            done(err);
        }
    }, function (err) {
        if (err) {
            taskDone(err);
        } else {
            taskDone();
        }
    });
}*/

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
            grunt.file.write(packedFileName, file);

            return path.relative(siteRoot, packedFileName);
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

            startNodes = startNodes.concat(getStartNodeByTemplate(tmplName, application));
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

    if (className in $ws._const.jsCoreModules || className in $ws._const.jsModules) {
        moduleName = className;
    } else {
        moduleName = "SBIS3.CORE." + className;
    }

    return new Promise((resolve, reject) => {
        $ws.requireModule(moduleName).addCallbacks(function (modArray) {
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
    dependency = global.$ws.single.ClassMapper.getClassMapping(dependency);

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