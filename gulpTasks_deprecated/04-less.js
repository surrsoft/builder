'use strict';

const fs             = require('fs');
const path           = require('path');
const through2       = require('through2');
const gutil          = require('gulp-util');
const PluginError    = gutil.PluginError;
const VFile          = require('vinyl');
const less           = require('less');
const minimatch      = require('minimatch');
const argv           = require('yargs').argv;
const assign         = require('object-assign');
// const translit       = require('../lib/utils/transliterate');
const applySourceMap = require('vinyl-sourcemaps-apply');
const DEFAULT_THEME  = 'online';
const themes         = ['online', 'carry', 'presto', 'carrynew', 'prestonew'];
let themesPath;    /*= path.join(/!*rootPath, *!/'SBIS3.CONTROLS/themes/');*/

let modulesPaths = JSON.parse(fs.readFileSync(argv.modules));
for (let i = 0, l = modulesPaths.length; i < l; i++) {
    if (modulesPaths[i].endsWith('SBIS3.CONTROLS')) {
        themesPath = path.join(modulesPaths[i], 'themes');
        break;
    }
}

let files = [];

module.exports = opts => {
    opts = assign({}, {
        acc: null
    }, opts);

    return through2.obj(
        function (file, enc, cb) {
            if (file.isStream()) return cb(new PluginError('gulp-sbis-less', 'Streaming not supported'));
            // if (!opts.acc) return cb(new PluginError('gulp-sbis-less', 'acc option is required'));
            // if (!minimatch(file.path, '**/{Модули интерфейса,ws}/**/*.less')) return cb(null, file);
            if (!minimatch(file.path, '**/*.less')) return cb(null, file);

            if (file.sourceMap) opts.sourcemap = true;

            // let theme = resolveThemeName(opts.acc.getFile(file.path).dest);
            let theme = resolveThemeName(file.path);

            if (itIsControl(file.path)) {
                for (let themeName of themes) {
                    files.push({
                        __WS: file.__WS || false,
                        base: file.base,
                        path: file.path,
                        contents: file.contents + '',
                        themeName: themeName
                    });
                    // processLessFile(file, themeName, true, cb);
                }
            } else {
                return processLessFile(file, theme, false, cb);
            }

            cb(null, file);
        },
        function (cb) {
            if (files.length) {
                let promises = [];
                for (let i = 0, l = files.length; i < l; i++) {
                    promises.push(new Promise((resolve, reject) => {
                        processLessFile(files[i], files[i].themeName, true, resolve, this);
                    }));
                }
                Promise.all(promises).then(() => {
                    cb();
                    files = [];
                });
            } else {
                cb();
            }
        }
    )
};

function resolveThemeName(filepath) {

    let regexpMathch    = filepath.match(new RegExp('\/resources\/([^/]+)'), '');
    let s3modName       = regexpMathch ? regexpMathch[1] : 'smth';

    switch (s3modName) {
        case 'Управление облаком':
            return 'cloud';
        case 'Upravlenie_oblakom':
            return 'cloud';
        case 'Presto':
            return 'presto';
        case 'sbis.ru':
            return 'sbisru';
        case 'Retail':
            return 'carry';
        default:
            return 'online';
    }
}

function itIsControl (path) {
    let truePath = path.replace(/\\/g, '/');
    return ~truePath.indexOf('SBIS3.CONTROLS/components');
}

// processLessFile(file.contents.toString('utf8'), file.path, themeName, true);
function processLessFile(file, theme, itIsControl, cb, ctx) {
    let vars        = path.join(themesPath, theme, 'variables');
    let mixins      = path.join(themesPath, 'mixins');
    let lessData    = file.contents + '';
    let imports     = theme ?
            `
            @import '${vars}';
            @import '${mixins}';
            @themeName: ${theme};

            ` : '';

    less.render(imports + lessData, {
        filename: file.path,
        cleancss: false,
        relativeUrls: true,
        strictImports: true
    }, function writeCSS (compileLessError, output) {

        if (compileLessError) {
            let message = `${compileLessError.message} in file: ${compileLessError.filename} on line: ${compileLessError.line}`;
            // FIXME: постоянно ошибки, возможно это нормально !!!
            // return cb(new PluginError('gulp-sbis-less', message));
            // if (!ctx) gutil.log('gulp-sbis-less: ' + message);
            return cb(null, file);
        }

        let suffix = '';

        if (itIsControl) suffix = ( theme === DEFAULT_THEME ) ? '' : `__${theme}`;
        file.path = gutil.replaceExtension(file.path, suffix + '.css');
        file.contents = new Buffer(output.css);

        if (ctx) {
            ctx.push(new VFile({
                // cwd base path contents
                __WS: file.__WS || false,
                base: file.base,
                path: file.path,
                contents: file.contents
            }));
            return cb();
        }
        /*if (output.sourcemap) {
            output.sourcemap.file = file.relative;
            output.sourcemap.sources = output.sourcemap.sources.map(function (source) {
                return path.relative(file.base, source);
            });

            applySourceMap(file, output.sourcemap);
        }*/
        cb(null, file);
    });
}