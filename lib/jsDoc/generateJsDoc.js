var path = require('path');
var fs = require('fs');
var child_process = require('child_process');
var os = require('os');
const mkdirp = require('mkdirp');
const gutil  = require('gulp-util');

module.exports = function generateJsDoc(grunt, jsonInput, jsonOutput, cb) {
    var err = null;
    mkdirp.sync(jsonOutput);

    gutil.log('Построение метаинформации начато.');

    var node = os.platform() === 'win32' ? path.join(__dirname, 'node.exe') : 'node';

    var jsDocWorker = child_process.spawn(node, [
        path.join(__dirname, 'json-generation-env.js'),
        'input=' + jsonInput,
        'cache=' + jsonOutput
    ]);

    jsDocWorker.stdout.on('data', function (data) {
        console.log(data.toString());
    });

    jsDocWorker.stderr.on('data', function (data) {
        err = data;
        console.log('error: ', data.toString());
    });

    jsDocWorker.on('close', function (code) {
        gutil.log('JSON generation process exited with code ' + code);

        gutil.log('Построение метаинформации выполнено.');

        cb(err);
    });
};