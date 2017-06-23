var path = require('path');
var fs = require('fs');
var child_process = require('child_process');
var os = require('os');

module.exports = function generateJsDoc(grunt, jsonInput, jsonOutput, cb) {
    var err = null;
    grunt.file.mkdir(jsonOutput);

    grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации начато.');

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
        grunt.log.ok('JSON generation process exited with code ' + code);

        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение метаинформации выполнено.');

        cb(err);
    });
};