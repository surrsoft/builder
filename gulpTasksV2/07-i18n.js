'use strict';
/*
*  Сейчас эта таска должна запускаться после завершения потока и самой последней.
*  Так же должна быть отключена паковка, сейчас думаю над инкрементальной версией этой таски
* */
const path              = require('path');
const through2          = require('through2');
const nlog              = require('../lib/logger-native');
const argv              = require('yargs').argv;
const indexDictFunc     = require('../lib/i18n/indexDictionary').indexDict;
const prepareXHTMLfunc  = require('../lib/i18n/prepareXHTML').prepareXHTML;
const resultDict        = require('../lib/i18n/createResultDictionary').createResultDict;
const genJsDoc          = require('../lib/jsDoc/generateJsDoc');


module.exports = opts => {
    return through2.obj(
        function (file, enc, cb) {
            cb(null, file);
        },
        function (cb) {
            nlog.info('Запускается задача i18n');
            Promise.all([
                jsonGenerate(),
                createResultDict(),
                prepareXHTML(),
                indexDict()
            ]).then(() => {
                nlog.info('Задача i18n выполнена');
                cb();
            }).catch(cb);
        }
    )
};

let data = { // конфиг таски i18n в grunt-е
    root: argv.root,
    application: argv.application,
    cwd: path.join(argv.root, argv.application),
    dict: /\/lang\/..-..\/(..-..)\.json$/,
    css: /\/lang\/..-..\/(..-..)\.css$/,
    country: /\/lang\/..\/(..)\.css$/,
    packages: 'resources/WI.SBIS/packer/i18n'
};

function jsonGenerate () {
    let modules     = argv.modules.replace(/"/g, '');
    let cache       = argv['json-cache'].replace(/"/g, '');
    let jsonOutput  = cache || path.join(__dirname, '../../../jsDoc-json-cache');

    return new Promise((resolve, reject) => {
        genJsDoc(null, modules, jsonOutput, err => {
            if (err) return reject(err);
            resolve();
        })
    });
}

function createResultDict () {
    return new Promise((resolve, reject) => {
        resultDict(null, err => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function prepareXHTML () {
    return new Promise((resolve, reject) => {
        prepareXHTMLfunc(null, data, err => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function indexDict () {
    return new Promise((resolve, reject) => {
        indexDictFunc(null, argv['index-dict'], data, err => {
            if (err) return reject(err);
            resolve();
        });
    });
}