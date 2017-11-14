/**
 Author: ✰ Konstantin Aleksandrov ✰
**/

'use strict';

const fs                    = require('fs');
const path                  = require('path');
const minimatch             = require('minimatch');
const gulp                  = require('gulp');
const gulpif                = require('gulp-if');
const through2              = require('through2').obj;
const gzip                  = require('gulp-gzip');
const chmod                 = require('gulp-chmod');
const argv                  = require('yargs').argv;
const translit              = require('./../lib/utils/transliterate');

/*  TASKS  */
const acc        = require('./01-acc');
const traverse   = require('./02-traverse');
// const deprecated = require('./03-deprecated');
const less       = require('./04-less');
const tmplBuild  = require('./05-tmpl-build');
const tmplMin    = require('./06-tmpl-min');
const pack       = require('./07-pack');

Error.stackTraceLimit = Infinity;

let modulesPaths = fs.readFileSync(argv.modules);
    modulesPaths = JSON.parse(modulesPaths);

module.exports = () => {
    if (!process.env.APPROOT && !process.env.ROOT) {
        process.env.APPROOT  = argv.application;
        process.env.ROOT     = path.resolve(argv.root);
        require('grunt-wsmod-packer/lib/node-ws')();
    }

    let since = 1;

    try {
        since = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'lastmtime.json'))).lastmtime;
    } catch (err) {
        // console.error(err);
    }

    let src = modulesPaths.map(p => p + path.sep + '**' + path.sep + '*.*');
    src.push(path.join(argv['ws-path'], './**/*.*'));
    src.push('!' + path.join(argv['ws-path'], './**/node_modules/**/*.js'));
    src.push('!' + path.join(argv['ws-path'], './**/*.gz'));
        // src.push(path.join(argv.root, argv.application, 'ws/**/*.*'));
        // src = src.concat(wsIgnore);
        // TODO: считывать весь WS ???
        // src.push('!' + path.join(argv.root, argv.application, 'ws/**/node_modules/**/*.js'));
        // src.push('!' + path.join(argv.root, argv.application, 'ws/**/*.gz'));
        // src.push('!' + path.join(argv.root, argv.application, 'ws/**/*.test.js'));
        // src.push('!' + path.join(argv.root, argv.application, 'ws/**/*.routes.js'));
        // src.push('!' + path.join(argv.root, argv.application, 'ws/**/*.worker.js'));
        // src.push('!' + path.join(argv.root, argv.application, 'ws/**/design/**/*.js'));
        // src.push('!' + path.join(argv.root, argv.application, 'ws/**/service/**/*.js'));

    let base;

    if (global.__CHANGED__) { // ТОЛЬКО ДЛЯ WATCHER-a
        src  = global.__CHANGED__;
        // FIXME: в исходниках нет Модули интерфейса
        base = /.+Модули\sинтерфейса/i.exec(global.__CHANGED__)[0];
    }

    if (global.__ADD__) {  // ТОЛЬКО ДЛЯ WATCHER-a
        src   = global.__ADD__;
        // FIXME: в исходниках нет Модули интерфейса такой вариант канает только для дистриба
        base  = /.+Модули\sинтерфейса/i.exec(global.__ADD__)[0];
        since = 1;
    }

    if (global.__UNLINKED__) {  // ТОЛЬКО ДЛЯ WATCHER-a
        // FIXME: в исходниках нет Модули интерфейса такой вариант канает только для дистриба
    }

    return gulp.src(src, { since: since, base: base })
        .pipe(acc({ modules: modulesPaths }))
        .pipe(traverse({ acc: acc }))
        // .pipe(deprecated({ acc: acc })) // Таска deprecated - задепрекейчена :)))
        .pipe(less())
        // .pipe(tmplBuild({ acc: acc }))
        // .pipe(tmplMin())
        /*.pipe(gulpif(file => file.__TMPL__ || path.extname(file.path) == '.js', uglify()))
        .pipe(gulpif(file => {
            return [
                    '**!/!*.{js,hdl}',
                    '!**!/!*.min.js',
                    '!**!/!*.routes.js',
                    '!**!/!*.worker.js',
                    '!**!/!*.test.js',
                    '!**!/design/!**!/!*.js',
                    '!**!/data-providers/!*.js',
                    '!**!/node_modules/!**!/!*.js',
                    '!**!/inside.tensor.js',
                    '!**!/online.sbis.js',
                    '!**!/service/!**!/!*.js'
                ].every(glob => minimatch(file.path, glob)) || file.__TMPL__;
        }, minify({
            mangle: {
                except: ['define']
            },
            deadcode: true,
            mergeVars: true,
            propertyLiterals: false,
            numericLiterals: false,
            simplifyComparisons: false,
            flipComparisons: false,
            evaluate: false
        }))) // babel-minify
        .pipe(gulpif(file => {
            return [
                '**!/!*.css',
                '!**!/!*.min.css',
                '!**!/design/!**!/!*.css',
                '!**!/node_modules/!**!/!*.css',
                '!**!/service/!**!/!*.css'
            ].every(glob => minimatch(file.path, glob));
        }, cssnano()))*/
        .pipe(chmod({
            owner: {
                read: true,
                write: true,
                execute: true
            },
            group: {
                read: true,
                write: true,
                execute: true
            },
            others: {
                read: true,
                write: true,
                execute: true
            }
        }))
        // .pipe(pack({ acc: acc }))
        .pipe(gulp.dest(file => {
            if (file.__MODULE_MANIFEST__) {
                return file.__WS ? path.join(argv.root, argv.application) : path.join(argv.root, argv.application, 'resources');
            } else if (file.__WS) {
                return path.join(argv.root, argv.application, 'ws');
            } else if (file.__MANIFEST__) {
                return path.join(argv.root, argv.application, 'resources');
            } else if (file.__STATIC__) {
                return path.join(argv.root, argv.application);
            } else {
                file.base = translit(file.base);
                file.path = translit(file.path);
                return path.join(argv.root, argv.application, 'resources'/*, translit(path.basename(file.base))*/)
            }
        }))
        .pipe(gulpif(file => {
            if (file.__STATIC__) return false;
            return !(/\.original\.[xhtmltp]{3,5}$/i.test(file.path));
        }, gzip({ threshold: 1024, gzipOptions: { level: 9 } })))
        .pipe(gulpif(file => '.gz' == path.extname(file.path), gulp.dest(file => {
            if (file.__MODULE_MANIFEST__) {
                return file.__WS ? path.join(argv.root, argv.application) : path.join(argv.root, argv.application, 'resources');
            } else if (file.__WS) {
                return path.join(argv.root, argv.application, 'ws');
            } else if (file.__MANIFEST__) {
                return path.join(argv.root, argv.application, 'resources');
            } else if (file.__STATIC__) {
                return path.join(argv.root, argv.application);
            } else {
                file.base = translit(file.base);
                file.path = translit(file.path);
                return path.join(argv.root, argv.application, 'resources'/*, translit(path.basename(file.base))*/)
            }
        })));
};