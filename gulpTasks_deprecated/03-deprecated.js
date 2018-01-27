'use strict';

const path           = require('path');
const through2       = require('through2');
const gutil          = require('gulp-util');
const PluginError    = gutil.PluginError;
// const argv           = require('yargs').argv;
const assign         = require('object-assign');
const translit       = require('../lib/transliterate');
// const applySourceMap = require('vinyl-sourcemaps-apply');


module.exports = opts => {
    opts = assign({}, {
        acc: null, // файлы, которые добавлять в аккумулятор
        contents: null
    }, opts);

    return through2.obj(
        function (file, enc, cb) {
            if (file.isStream()) return cb(new PluginError('gulp-sbis-deprecated', 'Streaming not supported'));
            if (!opts.acc) return cb(new PluginError('gulp-sbis-deprecated', 'acc option is required'));
            // if (!opts.contents) return cb(new PluginError('gulp-sbis-deprecated', 'contents option is required'));

            if (/\.xml\.deprecated$/i.test(file.relative)) {
                let basexml = path.basename(file.relative, '.xml.deprecated');
                opts.acc.addContentsXmlDeprecated(basexml, translit(file.relative).replace('.xml.deprecated', '').replace(/\\/g, '/'));
                file.path = file.path.replace('.xml.deprecated', '.xml');

            } else if (/\.html\.deprecated$/i.test(file.relative)) {
                let basehtml = path.basename(file.relative, '.deprecated');
                let parts    = basehtml.split('#');
                opts.acc.addContentsHtmlDeprecated(parts[0], (parts[1] || parts[0]).replace(/\\/g, '/'));
            }
            cb(null, file);
        },
        function (cb) {
            cb();
        }
    )
};
