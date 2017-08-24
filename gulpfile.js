/**
 Author: ✰ Konstantin Aleksandrov ✰
*/

'use strict';

const semver = require('semver');
if (semver.lt(semver.clean(process.versions.node), '4.0.0') || parseFloat(process.versions.v8) < 4.5) {
    /* jshint -W101 */
    console.log('*********************************************\n*  Для запуска требуется Node.js v4 и выше  *\n*  Для запуска требуется V8 v4.5 и выше     *\n*  Пожалуйста обновитесь.                   *\n*********************************************');
    process.exit();
}

process.on('uncaughtException',  err => { console.error(err); });
process.on('unhandledRejection', err => { console.error(err); });

global.__DEVELOPMENT__ = process.env.NODE_ENV === 'development';

const fs            = require('fs');
const path          = require('path');
const gulp          = require('gulp');
const watch 	    = require('gulp-watch');
const gutil         = require('gulp-util');

const acc           = require('./gulpTasksV2/01-acc');
const yargs         = require('yargs');


// FIXME: путь до WS
const argv = yargs
    .options({
        root: {
            demandOption: true,
            describe: 'путь куда деплоить',
            type: 'string'
        },
        application: {
            default: '/',
            describe: 'путь куда деплоить `debug` версию',
            type: 'string'
        },
        modules: {
            demandOption: true,
            describe: 'путь до файла с именами модулей (modules.json)',
            type: 'string'
        },
        'ws-path': {
            demandOption: true,
            describe: 'путь до WS',
            type: 'string'
        },
        service_mapping: {
            describe: 'service_mapping',
            type: 'string'
        },
        'index-dict': {
            describe: 'i18n (локализация)',
            type: 'boolean'
        }
    })
    .demandOption(['root', 'modules'], 'задача должна запускаться с опциями `root` и `modules`')
    .command('gulp TASK_NAME [root] [application] [modules]', 'запуск таски TASK_NAME')
    .example('gulp TASK_NAME', '--root=c:/public --application=/ --modules=./modules.json')
    .usage('Usage: $0 -root [path] -application [path] -modules [path]')
    .epilog('copyright ©TENSOR')
    .help()
    .argv;

let since     = 1;
try {
    since = JSON.parse(fs.readFileSync(path.join(argv.root, 'resources', 'lastmtime.json'))).lastmtime;
} catch (err) {
    gutil.log(err);
}

gulp.task('ws-copy', function () {
    return gulp.src(path.join(argv['ws-path'], './**/*.*'), { since: since })
        .pipe(gulp.dest(path.join(argv.root, 'ws')));
});

gulp.task('build', require('./gulpTasksV2/index'));
// FIXME: самое первое что надо делать - это копировать WS !!!!
// gulp  --root=C:/projects/test_builder/public/grunt_distr --application=// --modules="C:/projects/test_builder/modules.json" --service_mapping="PHPRPC /tel/service/index.php catalogServiceUrl http://etodelo.ru/service/ specifications /specifications/service/ sppServiceUrl http://ea1-crm-sphinx-dev/spp/service/ Классификатор /class/service/"
gulp.task('default', gulp.series('ws-copy', 'build'));

// NODE_ENV=development gulp watch  --root=C:/projects/test_builder/public/grunt_distr --application=// --modules="C:/projects/test_builder/modules.json" --service_mapping="PHPRPC /tel/service/index.php catalogServiceUrl http://etodelo.ru/service/ specifications /specifications/service/ sppServiceUrl http://ea1-crm-sphinx-dev/spp/service/ Классификатор /class/service/"
gulp.task('watch', done => {
    if (argv.modules) {
        let modulesPaths = require(argv.modules);
        modulesPaths = modulesPaths.map(p => (path.normalize(p) + path.sep + '**' + path.sep + '*.*').replace(/\(|\)/g,'*'));

        watch(modulesPaths, { disableGlobbing: false/*, followSymlinks: false*/ }, gulp.series('default'))
            // Available events: add, addDir, change, unlink, unlinkDir, ready, raw, error
            .on('change', filepath => {
                console.log("on change");
                global.__CHANGED__ = filepath;
                gutil.log('File ' + filepath + ' is changed');
            })
            .on('add', filepath => {
                console.log("on add");
                global.__ADD__ = filepath;
                gutil.log('Added new file ' + filepath);
                acc.add(filepath);
            })
            .on('unlink', filepath => {
                // TODO: при удалении файла нужно из аккумулятора получать файлы, у которых в зависимостях был удаленный файл и их записывать в global.__CHANGED__
                console.log("on unlink");
                global.__UNLINKED__ = filepath;
                global.__CHANGED__  = null;
                global.__ADD__      = null;
                gutil.log('File ' + filepath + ' was deleted');
                acc.remove(filepath);

            });

    } else {
        done('--modules is required!');
    }
});

/*gulp.task('convert',        require('./gulpTasks/converter'));
 gulp.task('static-html',    require('./gulpTasks/subTasks/static-html_v2'));
 gulp.task('packjs',         require('./gulpTasks/packjs'));*/

/*
const remember      = require('gulp-remember');
gulp.task('watch', done => {
    global.__DEVELOPMENT__ = true;
    if (argv.modules) {
        let modulesPaths = require(argv.modules);
            modulesPaths = modulesPaths.map(p => (path.normalize(p) + path.sep + '**' + path.sep + '*.*').replace(/\(|\)/g,'*'));
        watch(modulesPaths, { disableGlobbing: false/!*, followSymlinks: false*!/ }, gulp.series('convert')).on('unlink', filepath => {
            // remember.forget('convert', path.resolve(filepath));
            // delete cache.caches.convert[path.resolve(filepath)];
        });
    } else {
        done('--modules is required!')
    }
});*/
// gulp.task('default', gulp.series('convert', 'static-html', 'packjs'));
