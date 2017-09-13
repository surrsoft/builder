'use strict';

const fs             = require('fs');
const path           = require('path');
const through2       = require('through2');
const gutil          = require('gulp-util');
const PluginError    = gutil.PluginError;
const VFile          = require('vinyl');
const argv           = require('yargs').argv;
const assign         = require('object-assign');
const translit       = require('../lib/utils/transliterate');
const applySourceMap = require('vinyl-sourcemaps-apply');
// const dblSlashes = /\\/g;
let deps = ['Core/tmpl/tmplstr', 'Core/tmpl/config'];
let tmpl, config, tclosure, tclosureStr;
// let attempt = 0;

let executePaths = [];

module.exports = opts => {
    opts = assign({}, {
        acc: null
    }, opts);

    return through2.obj(
        function (file, enc, cb) {
            if (file.isStream()) return cb(new PluginError('gulp-sbis-tmpl-build', 'Streaming not supported'));
            if (!opts.acc) return cb(new PluginError('gulp-sbis-tmpl-build', 'acc option is required'));
            if (!['.tmpl', '.html', '.xhtml'].some(ext => ext == path.extname(file.path))) return cb(null, file);
            if (file.sourceMap) opts.sourcemap = true;

            if (!/\.original\.[tmplxh]{4,5}$/i.test(file.path) && !file.__STATIC__) {
                executePaths.push(file.path + '');
                file.path = gutil.replaceExtension(file.path, '.original' + path.extname(file.path));
            }

            cb(null, file);
        },
        function (cb) {
            // process.env.APPROOT  = argv.application;
            // process.env.ROOT     = path.resolve(argv.root);
            // require('grunt-wsmod-packer/lib/node-ws')();
            let ctx = this;
            if (!tclosureStr) {
                global.requirejs(deps.concat(['optional!Core/tmpl/js/tclosure']), function (_tmpl, _config, _tclosure) {
                    tclosureStr = '';
                    tmpl = _tmpl; config = _config; tclosure = _tclosure;

                    if (tclosure) {
                        deps.push('Core/tmpl/js/tclosure');
                        tclosureStr = 'var tclosure=deps[0];';
                    }

                    execute(opts, cb, ctx);
                })
            } else {
                execute(opts, cb, ctx);
            }

        }
    )
};

function execute (opts, cb, ctx) {
    if (!executePaths.length) return cb();

    if (!tclosureStr) return cb(new PluginError('gulp-sbis-tmpl-build', 'global.requirejs Did not work'));
    /*if (!tclosureStr && attempt < 5) {
     return setTimeout(task, 200, file, enc, cb, opts);
     }
     if (!tclosureStr && attempt >= 5) {
     return cb(new PluginError('gulp-sbis-tmpl-build', 'global.requirejs Did not work'));
     }*/

    // FIXME: тут возможны тормоза при dev-watch
    let graphJSON   = JSON.parse(opts.acc.graph.toJSON());
    let nodes       = graphJSON.nodes;

    let nodesRevert = {};
    for (let k in nodes) {
        if (k.startsWith('tmpl!') || k.startsWith('html!')) nodesRevert[nodes[k].path] = k;
    }

    let promises = [];

    for (let i = 0, l = executePaths.length; i < l; i++) {
        let file = opts.acc.getFile(executePaths[i]);
        promises.push(
            task(file, opts, nodesRevert).then(file => {
                if (!file) return true;
                let newFile = new VFile({
                    base: file.base,
                    path: file.path,
                    contents: Buffer.from(file.contents + ''),
                    __TMPL__: true
                });
                newFile.__WS = file.__WS || false;
                ctx.push(newFile);
            }, err => {
                console.error('ОШИБКА:', err);
                return true;
            })
        );

    }
    Promise.all(promises).then(() => {
        executePaths = [];
        let moduleDependenciesJSON = new VFile({
            // cwd base path contents
            base: path.join(argv.root, argv.application, 'resources'),
            path: path.join(argv.root, argv.application, 'resources', 'module-dependencies.json'),
            contents: new Buffer(opts.acc.graph.toJSON())
        });
        moduleDependenciesJSON.__MANIFEST__ = true;
        ctx.push(moduleDependenciesJSON);
        cb();
    }).catch(err => {
        // executePaths = [];
        console.error('ОШИБКА:', err);
        cb(err);
    });
}

function task (file, opts, nodesRevert) {
    if (!file) return Promise.resolve();

    let filename;
    if (/[\/\\]ws[\/\\]?$/i.test(file.base)) {
        filename = path.join('ws', file.relative);
    } else {
        filename = path.join('resources', translit(file.relative));
    }
    // TODO: попробовать filename = file.path, хотя все равно нихера толку
    let fullName = nodesRevert[filename];

    if (path.extname(filename) == '.tmpl') {
        filename = filename.replace(/\\/g, '/');

        let _deps   = JSON.parse(JSON.stringify(deps));
        let result  = ['var templateFunction = '];
        let conf    = { config: config, filename: filename, fromBuilderTmpl: true };

        let templateRender = Object.create(tmpl);

        let html = file.contents + ''/*.toString('utf8')*/;

        html = stripBOM(html);

        return new Promise((resolve, reject) => {
            if (html.indexOf('define') == 0) {
                return resolve();
            }

            templateRender.getComponents(html).forEach(function (dep) {
                _deps.push(dep);
            });

            templateRender.template(html, resolverControls, conf).handle(function (traversed) {
                try {
                    if (traversed.__newVersion === true) {
                        /**
                         * Новая версия рендера, для шаблонизатора. В результате функция в строке.
                         */
                        let tmplFunc = templateRender.func(traversed, conf);
                        result.push(tmplFunc.toString() + ';');

                        if (tmplFunc.includedFunctions) {
                            result.push('templateFunction.includedFunctions = {');
                            result.push('};');
                        }
                    } else {
                        result.push('function loadTemplateData(data, attributes) {');
                        result.push('return tmpl.html(' + JSON.stringify(traversed) + ', data, {config: config, filename: "' + fullName + '"}, attributes);};');
                    }

                    result.push('templateFunction.stable = true;');
                    result.push('templateFunction.toJSON = function() {return {$serialized$: "func", module: "' + fullName + '"}};');
                    result.push('return templateFunction;');

                    _deps.splice(0, 2);
                    let
                        depsStr = 'var _deps = {};',
                        i = tclosure ? 1 : 0;
                    for (; i < _deps.length; i++) {
                        depsStr += '_deps["' + _deps[i] + '"] = deps[' + i + '];';
                    }

                    let data = `define("${fullName}",${JSON.stringify(_deps)},function(){var deps=Array.prototype.slice.call(arguments);${tclosureStr + depsStr + result.join('')}});`;

                    opts.acc.graph.markNodeAsAMD(fullName);
                    resolve({
                        __WS: file.__WS || false,
                        base: file.base,
                        path: file.path,
                        contents: data
                    });
                } catch (err) {
                    // gutil.log(err);
                    resolve();
                }
            }, function (err) {
                // gutil.log(err);
                resolve();
            });
        });
    } else {
        let html = file.contents + '';
        html = stripBOM(html);
        let config, template;

        return new Promise((resolve, reject) => {
            if (html.indexOf('define') == 0) {
                return resolve();
            }

            try {
                config = global.$ws.doT.getSettings();

                // FIXME: что это? откуда это?
                if (module.encode) config.encode = config.interpolate;

                template = $ws.doT.template(html, config);

                let data = `define("${fullName}",function(){var f=${template.toString().replace(/[\n\r]/g, '')};f.toJSON=function(){return {$serialized$:"func", module:"${fullName}"}};return f;});`;

                opts.acc.graph.markNodeAsAMD(fullName);
                resolve({
                    __WS: file.__WS || false,
                    base: file.base,
                    path: file.path,
                    contents: data
                });
            } catch (err) {
                gutil.log(err);
                resolve();
            }
        })
    }

}

function stripBOM (x) {
    if (x.charCodeAt(0) === 0xFEFF) {
        return x.slice(1);
    }

    return x;
}

function resolverControls(path) {
    return `tmpl!${path}`;
}