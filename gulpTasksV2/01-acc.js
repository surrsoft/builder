'use strict';

const fs                    = require('fs');
const path                  = require('path');
const through2              = require('through2');
const gutil                 = require('gulp-util');
const PluginError           = gutil.PluginError;
const VFile                 = require('vinyl');
const argv                  = require('yargs').argv;
const glob                  = require('glob');
const assign                = require('object-assign');
const DepGraph              = require('grunt-wsmod-packer/lib/dependencyGraph');
DepGraph.prototype.markNodeAsAMD = function (v) {
    if (this._nodes[v]) this._nodes[v].amd = true;
};

const translit              = require('../lib/utils/transliterate');
const removeLeadingSlash    = function removeLeadingSlash(path) {
    if (path) {
        var head = path.charAt(0);
        if (head == '/' || head == '\\') {
            path = path.substr(1);
        }
    }
    return path;
};
// const applySourceMap        = require('vinyl-sourcemaps-apply');
// const wsPath    = path.join(argv.root, argv.application, 'ws' + path.sep);
const wsPath    = path.join(argv['ws-path']);
const isUnixSep = path.sep === '/';
let since       = 0;
// let _acc        = null;
let _acc        = {};
let contents    = { // manifest
    modules: {},
    xmlContents: {},
    htmlNames: {},
    jsModules: {},
    services: {},
    requirejsPaths: {
        WS: removeLeadingSlash(path.join(argv.application, 'ws'))
    }
};

let moduleDependencies  = { nodes: {}, links: {} };
let deanonymizeData = {
    anonymous: {},
    badRequireDeps: {}
};
let routesInfo          = {};
let packwsmod           = {};
let packwsmodContents   = {};
let packjscss           = {};
// let packjscssContents   = {};
let custompack          = {};

try {
    // _acc            = JSON.parse(fs.readFileSync(path.join(argv.root, 'resources', 'acc.json')));
    contents = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'contents.json')));
} catch (err) {
    console.warn(err);
}
if (argv.service_mapping) {
    let srv_arr = argv.service_mapping.trim().split(' ');
    if (srv_arr.length % 2 == 0) {
        contents.services = contents.services || {};
        for (let i = 0, l = srv_arr.length; i < l; i += 2) contents.services[srv_arr[i]] = srv_arr[i + 1];
    } else {
        console.error('Services list must be even!');
    }
}

try {
    moduleDependencies = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'module-dependencies.json')));
} catch (err) {
    console.warn(err);
}
try {
    deanonymizeData = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'deanonymizeData.json')));
} catch (err) {
    console.warn(err);
}

try {
    routesInfo = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'routes-info.json')));
} catch (err) {
    console.warn(err);
}

try {
    packwsmod           = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'packwsmod.json')));
    packwsmodContents   = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'packwsmodContents.json')));
} catch (err) {
    console.warn(err);
}

try {
    packjscss = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'packjscss.json')));
    // packjscssContents   = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'packjscssContents.json')));
} catch (err) {
    console.warn(err);
}

try {
    custompack = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'custompack.json')));
} catch (err) {
    console.warn(err);
}

let modulesPaths = JSON.parse(fs.readFileSync(argv.modules));
for (let i = 0, l = modulesPaths.length; i < l; i++) {
    if (argv.application === translit(path.basename(modulesPaths[i]))) {
        throw new Error(
            `Имя сервиса и имя модуля облака не должны совпадать.
            Сервис: ${argv.application.replace('/', '')}'
            Модуль: ${translit(path.basename(modulesPaths[i]))}`
        );
    }

    let moduleNS = translit(path.basename(modulesPaths[i])); // path.basename(modulesPaths[i]);
    if (!contents.modules[moduleNS]) contents.modules[moduleNS] = moduleNS;
    if (!contents.requirejsPaths[moduleNS]) contents.requirejsPaths[moduleNS] = removeLeadingSlash(path.join(argv.application, 'resources', moduleNS)).replace(/\\/g,'/');
}

let graph = new DepGraph();
    graph.fromJSON(moduleDependencies);



let globPattern = patternFromModulesArr(modulesPaths, []);
let wsPattern   = path.join(argv.root, argv.application, 'ws/**/*.*');
// path.join(argv.root, argv.application, 'ws/**/*.*')
gutil.log('START CREATING ACC');
let filesArr = glob.sync(globPattern);
let wsArr    = glob.sync(wsPattern);
for (let i = 0, l = filesArr.length; i < l; i++) _acc[filesArr[i]]  = null;
for (let i = 0, l = wsArr.length; i < l; i++)    {
    if (wsArr[i].endsWith('.gz')) continue;
    _acc[wsArr[i]]     = null;
}
gutil.log('CREATING ACC DONE');

module.exports = opts => {
    opts = assign({}, {
        // файлы, контент которых сохранять в аккумуляторе (JS и tmpl обязательно, остальные пока не проверял...)
        ext: ['.js', '.tmpl', '.html', '.xhtml']
    }, opts);

    if (!Array.isArray(opts.ext)) opts.ext = [opts.ext];

    if (opts.modules/* && !_acc*/) {
        for (let i = 0, l = opts.modules.length; i < l; i++) {
            if (argv.application === translit(path.basename(opts.modules[i]))) {
                throw new Error(
                    `Имя сервиса и имя модуля облака не должны совпадать.
                        Сервис: ${argv.application.replace('/', '')}'
                        Модуль: ${translit(path.basename(opts.modules[i]))}`
                );
            }

            let moduleNS = translit(path.basename(modulesPaths[i])); // path.basename(modulesPaths[i]);
            if (!contents.modules[moduleNS]) contents.modules[moduleNS] = moduleNS;
            if (!contents.requirejsPaths[moduleNS]) contents.requirejsPaths[moduleNS] = removeLeadingSlash(path.join(argv.application, 'resources', moduleNS)).replace(/\\/g,'/');
        }
    } else {
        try {
            opts.modules = JSON.parse(fs.readFileSync(argv.modules));
            // globPattern  = patternFromModulesArr(opts.modules, opts.ext);
            for (let i = 0, l = opts.modules.length; i < l; i++) {
                if (argv.application === translit(path.basename(opts.modules[i]))) {
                    throw new Error(
                        `Имя сервиса и имя модуля облака не должны совпадать.
                        Сервис: ${argv.application.replace('/', '')}'
                        Модуль: ${translit(path.basename(opts.modules[i]))}`
                    );
                }

                let moduleNS = translit(path.basename(modulesPaths[i])); // path.basename(modulesPaths[i]);
                if (!contents.modules[moduleNS]) contents.modules[moduleNS] = moduleNS;
                if (!contents.requirejsPaths[moduleNS]) contents.requirejsPaths[moduleNS] = removeLeadingSlash(path.join(argv.application, 'resources', moduleNS)).replace(/\\/g,'/');
            }
        } catch(err) {
            opts.modules = err;
        }
    }

    return through2.obj(
        function (file, enc, cb) {
            if (file.isNull()) return cb(null, file);
            if (file.isStream()) return cb(new PluginError('gulp-sbis-acc', 'Streaming not supported'));
            if (opts.modules instanceof Error) return cb(new PluginError('gulp-sbis-acc', opts.modules.message));

            if (~file.path.indexOf(wsPath)) {
                file.path = path.join(argv.root, argv.application, 'ws', file.relative);
                file.base = path.join(argv.root, argv.application, 'ws');
                file.__WS = true;
            }

            let mtime = new Date(file.stat.mtime).getTime();
            if (mtime > since) since = mtime;


            let filePath = isUnixSep ? file.path : file.path.replace(/\\/g, '/');
            let dest = file.__WS ? path.join(argv.root, argv.application, 'ws', file.relative) : path.join(argv.root, argv.application,  'resources', translit(file.relative));

            if (['.styl', '.less', '.scss', '.sass'].some(ext => path.extname(dest) === ext)) {
                dest = gutil.replaceExtension(dest, '.css');
            }

            if (dest.endsWith('.package.json')) {
                custompack[dest] = file.contents + '';



            }

            _acc[filePath] = {
                __WS: file.__WS || false,
                cwd: file.cwd + '',
                base: file.base + '',
                path: file.path + '',
                relative: file.relative + '',
                dest: dest,
                contents: opts.ext.some(ext => ext === path.extname(file.relative)) ? file.contents.toString('utf8') : null
            };

            cb(null, file);
        },
        function (cb) {
            if (since) {
                let lastmtimeJSON = new VFile({
                    // cwd base path contents
                    base: path.join(argv.root, argv.application, 'resources'),
                    path: path.join(argv.root, argv.application, 'resources', 'lastmtime.json'),
                    contents: new Buffer(JSON.stringify({ lastmtime: since + 100 }))
                });
                lastmtimeJSON.__MANIFEST__ = true;
                this.push(lastmtimeJSON);
            }

            if (_acc) {
                let _contents = {};
                for (let k in _acc) _contents[k] = null;
                let accJSON = new VFile({
                    // cwd base path contents
                    base: path.join(argv.root, argv.application, 'resources'),
                    path: path.join(argv.root, argv.application, 'resources', 'acc.json'),
                    contents: new Buffer(JSON.stringify(_contents))
                });
                accJSON.__MANIFEST__ = true;
                this.push(accJSON);
            }

            cb();
        }
    );
};

Object.defineProperty(module.exports, 'acc', {
    enumerable: false,
    configurable: false,
    get: function () { return _acc; }
});

Object.defineProperty(module.exports, 'contents', {
    enumerable: false,
    configurable: false,
    get: function () { return contents; }
});

Object.defineProperty(module.exports, 'deanonymizeData', {
    enumerable: false,
    configurable: false,
    get: function () { return deanonymizeData; }
});

module.exports.modules      = modulesPaths;
module.exports.graph        = graph;
module.exports.routesInfo   = routesInfo;


module.exports.markAsAnonymous = filePath => {
    filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');

    if ((filePath in _acc) && _acc[filePath]) _acc[filePath].__anonymous = true;
};

module.exports.unMarkAsAnonymous = filePath => {
    filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');

    if ((filePath in _acc) && _acc[filePath]) _acc[filePath].__anonymous = false;
};

module.exports.markAsRoute = filePath => {
    filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');

    if ((filePath in _acc) && _acc[filePath]) _acc[filePath].__route = true;
};

module.exports.unMarkAsRoute = filePath => {
    filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');

    if ((filePath in _acc) && _acc[filePath]) _acc[filePath].__route = false;
};

/*module.exports.markAsTmplBuild = filePath => {
    filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');

    if ((filePath in _acc) && _acc[filePath]) _acc[filePath].__tmplbuild = true;
};

module.exports.unMarkAsTmplBuild = filePath => {
    filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');

    if ((filePath in _acc) && _acc[filePath]) _acc[filePath].__tmplbuild = false;
};*/

module.exports.addAst = (filePath, ast) => {
    filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');

    if ((filePath in _acc) && _acc[filePath]) _acc[filePath].__ast = ast;
};


module.exports.fillAnonymous = filePath => { deanonymizeData.anonymous[filePath] = 1; };

module.exports.fillBadRequireDeps = deps => {
    if (Array.isArray(deps)) {
        for (let i = 0, l = deps.length; i < l; i++) {
            deanonymizeData.badRequireDeps[deps[i]] = 1;
        }
    } else {
        deanonymizeData.badRequireDeps[deps] = 1;

    }
};

module.exports.setFileContents = (filePath, text) => {
    let _filePath = filePath.substring();
    let _filePathAcc = isUnixSep ? _filePath : _filePath.replace(/\\/g, '/');
    if (_acc[_filePathAcc]) _acc[_filePathAcc].contents = text;
};

module.exports.remove = filePath => {
    let _filePath = filePath.substring();

    // DELETE FROM ACC
    let _filePathAcc = isUnixSep ? _filePath : _filePath.replace(/\\/g, '/');
    delete _acc[_filePathAcc];

    // DELETE FROM CONTENTS.jsModules
    // FIXME: в исходниках нет Модули интерфейса
    let _filePathContents = /.+Модули\sинтерфейса[\/\\](.+)/i.exec(_filePath)[1];
        _filePathContents = translit(_filePathContents).replace(/\\/g, '/');
    for (let jsModule in contents.jsModules) {
        if (contents.jsModules[jsModule] === _filePathContents) {
            delete contents.jsModules[jsModule];
            break;
        }
    }
    // TODO: удалять из графа и всех зависимостей contents (возможно и физически из public)
};

module.exports.add = newPath => {
    let filePath = newPath.substring();

    if ('string' === typeof filePath) {
        filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');
        if (!(filePath in _acc)) _acc[filePath] = null;
    } else if (filePath.contents && filePath.cwd && filePath.base && filePath.path && filePath.relative) {
        let _filePath = isUnixSep ? filePath.path : filePath.path.replace(/\\/g, '/');
        if (_filePath in _acc) {
            _acc[_filePath] = {
                cwd: filePath.cwd + '',
                base: filePath.base + '',
                path: filePath.path + '',
                relative: filePath.relative + '',
                contents: filePath.contents.toString('utf8')
                // isNew: true,
            };
        }
    }
};

module.exports.loadFile = filePath => {
    filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');
    let base, relative;
    modulesPaths.forEach(m => {
        if (filePath.startsWith(m)) {
            base = path.join(m, '../');
            let re = new RegExp(m.replace(/\//g, '[\\/\\\\]').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + '[\\/\\\\]?(.+)');
            relative = (re.exec(filePath))[1]
        }
    });

    if (!base) {
        if (/[\/\\]ws[\/\\]/i.test(filePath)) {
            base = argv['ws-path'];
            let re = new RegExp(argv['ws-path'] + '[\\/\\\\]?(.+)');
            relative = (re.exec(filePath))[1]
        }
    }
    // let base        = /.+Модули\sинтерфейса|.+sbis3-builder/i.exec(filePath);
    // let relative    = /.+Модули\sинтерфейса[\/\\](.+)[\/\\]?|.+sbis3-builder[\/\\](.+)[\/\\]?/i.exec(filePath);
    _acc[filePath] = {
        cwd: process.cwd(),
        // base: base[0],
        base: base,
        path: filePath,
        // relative: relative[1],
        relative: relative,
        contents: fs.readFileSync(filePath) + ''
    };
};

module.exports.loadFileByRelative = relativePath => {
    // relativePath = isUnixSep ? relativePath : relativePath.replace(/\\/g, '/');
    relativePath = relativePath.replace(/[\/\\]/g, '.');
    relativePath = relativePath.replace(/\s/g, '\\s');
    let fullPath, base, relative;
    let re = new RegExp(relativePath + '$', 'i');

    for (let p in _acc) {
        // if (p.endsWith('grayTheme_newAccrodion.html')) {
        //     console.log('\np=', p);
        //     process.exit(0)
        //
        // }
        if (re.test(p)) {
            fullPath = p;
            break;
        }
    }
    if (fullPath) {
        modulesPaths.forEach(m => {
            if (fullPath.startsWith(m)) {
                base = path.join(m, '../');
                let re = new RegExp(m.replace(/\//g, '[\\/\\\\]').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + '[\\/\\\\]?(.+)');
                relative = (re.exec(fullPath))[1]
            }
        });
    }

    if (!base) {
        if (fullPath && /[\/\\]ws[\/\\]/i.test(fullPath)) {
            base = argv['ws-path'];
            let re = new RegExp(argv['ws-path'] + '[/\]?(.+)');
            relative = (re.exec(fullPath))[1]
        }
    }
    // let base        = /.+Модули\sинтерфейса|.+sbis3-builder/i.exec(filePath);
    // let relative    = /.+Модули\sинтерфейса[\/\\](.+)[\/\\]?|.+sbis3-builder[\/\\](.+)[\/\\]?/i.exec(filePath);
    _acc[fullPath] = {
        cwd: process.cwd(),
        // base: base[0],
        base: base,
        path: fullPath,
        // relative: relative[1],
        relative: relative,
        contents: fs.readFileSync(fullPath) + ''
    };

    return fullPath;
};

module.exports.getFile = filePath => {
    if ('string' === typeof filePath) {
        let _filePath = filePath.substring();
            _filePath = isUnixSep ? _filePath : _filePath.replace(/\\/g, '/');
        return (_acc[_filePath]);
    }
};

module.exports.getFileByDest = destPath => {
    let file;
    if ('string' === typeof destPath) {
        destPath = destPath.replace(/[\/\\]/g, path.sep);
        // console.log('destPath =', destPath)
        for (let fp in _acc) {
            if (_acc[fp] && _acc[fp].dest && _acc[fp].dest == destPath) {
                file = _acc[fp];
                break;
            }
        }
    }

    return file;
};

module.exports.getFileByRelativeDest = destPath => {
    let file;
    if ('string' === typeof destPath) {
        destPath = destPath.replace(/[\/\\]/g, path.sep);
        for (let fp in _acc) {
            if (_acc[fp] && _acc[fp].dest && _acc[fp].dest.endsWith(destPath)) {
                file = _acc[fp];
                break;
            }
        }
    }

    return file;
};

module.exports.getFilePathByRelativeDest = destPath => {
    let file;
    if ('string' === typeof destPath) {
        destPath = destPath.replace(/[\/\\]/g, path.sep);
        for (let fp in _acc) {
            if (_acc[fp] && _acc[fp].dest && _acc[fp].dest.endsWith(destPath)) {
                file = _acc[fp].path;
                break;
            }
        }
    }

    return file;
};

module.exports.addContentsJsModule = (moduleName, fileRelative) => {
    contents.jsModules[moduleName] = translit(fileRelative).replace(/\\/g, '/');
};

module.exports.addContentsHtmlNames = (k, v) => { contents.htmlNames[k] = v; };


// let parsepackwsmod = true;
module.exports.packwsmod            = packwsmod;
module.exports.packwsmodContents    = packwsmodContents;
module.exports.packwsmodXML         = null;

module.exports.packjscss            = packjscss;
module.exports.custompack           = custompack;
// module.exports.packjscssContents    = packjscssContents;

/*Object.defineProperty(module.exports, 'parsepackwsmod', {
    enumerable: false,
    configurable: false,
    get: function () { return parsepackwsmod; },
    set: function (v) { parsepackwsmod = v; }
});*/

module.exports.addContentsXmlDeprecated = (k, v) => {
    v = v.replace(/^[\/\\]{0,1}resources[\/\\]{0,1}/i, '');
    contents.xmlContents[k] = v;
    // parsepackwsmod = true;
};

module.exports.addContentsHtmlDeprecated = (k, v) => { contents.htmlNames[k] = v; };

module.exports.containsPath = filePath => {
    if ('string' === typeof filePath) {
        let _filePath = filePath.substring();
            _filePath = isUnixSep ? _filePath : _filePath.replace(/\\/g, '/');
        if (_acc[_filePath]) return true;
        return false;
    }
};

module.exports.hasPath = filePath => {
    if ('string' === typeof filePath) {
        let _filePath = filePath.substring();
        _filePath = isUnixSep ? _filePath : _filePath.replace(/\\/g, '/');
        return _filePath in _acc;
    }
};

module.exports.clear = () => { for (let key in _acc) _acc[key] = null; };

function patternFromModulesArr (modules) {
    let res = '{';
    let l = modules.length;
    modules.forEach((m, i) => {
        res += m;
        if ((l - 1) == i) {
            res += '}/**/*.*'
        } else {
            res += ',';
        }
    });
    return res;
}
/*
function patternFromModulesArr (modules, ext) {
    let _base     = {};
    let _relative = {};
    let _result   = '';

    modules.forEach(m => {
        // let baseKey = /.+Модули\sинтерфейса/i.exec(m);
        let baseKey = /(.+[\/\\])([A-Za-zА-Яа-я_0-9\s\-\.]{1,100})$/i.exec(m);
        if (Array.isArray(baseKey)) _base[path.normalize(baseKey[1])] = true;

        // let relativeKey = /.+Модули\sинтерфейса[\/\\](.+)[\/\\]?/i.exec(m);
        let relativeKey = baseKey;
        if (Array.isArray(relativeKey) && relativeKey.length >= 3) _relative[path.normalize(baseKey[2])] = true;
    });

    if (Object.keys(_base).length > 1) {
        _result += '{';
        for (let k in _base) {
            if (_result = '{') {
                _result += k;
            } else {
                _result += (',' + k);
            }
        }
        _result += '}';
    } else if (Object.keys(_base).length === 1) {
        _result = Object.keys(_base)[0];
    }
    if (Object.keys(_relative).length > 1) {
        _result += path.sep + '{';
        for (let k in _relative) {
            if (_result.endsWith('{')) {
                _result += k;
            } else {
                _result += (',' + k);
            }
        }
        _result += '}' + path.sep + '**' + path.sep + '*.*';
        /!*_result += '}' + path.sep + '**' + path.sep + '*{';

        for (let i = 0, l = ext.length; i < l; i++) {
            if (_result.endsWith('{')) {
                _result += ext[i];
            } else {
                _result += (',' + ext[i]);
            }
        }
        _result += '}';*!/
    } else if (Object.keys(_relative).length === 1) {
        _result += path.sep + Object.keys(_relative)[0] + path.sep + '**' + path.sep + '*.*';
        /!*_result += path.sep + Object.keys(_relative)[0] + path.sep + '**' + path.sep + '*{';
        for (let i = 0, l = ext.length; i < l; i++) {
            if (_result.endsWith('{')) {
                _result += ext[i];
            } else {
                _result += (',' + ext[i]);
            }
        }
        _result += '}';*!/
    }

    return _result;
}*/
