"use strict";

var path = require('path');
var fs = require('fs');
var dblSlashes = /\\/g;

function getFirstLevelDirs(applicationRoot) {
    var resources = path.join(applicationRoot, 'resources'),
        dirs;

    dirs = fs.readdirSync(resources).map(function (e) {
        return path.join(resources, e);
    });

    return dirs.filter(function (e) {
        return fs.statSync(e).isDirectory();
    });
}

function replaceContents(grunt, requirejsPaths, applicationRoot) {
    var resourcesRoot = path.join(applicationRoot, 'resources');
    try {
        var content = grunt.file.readJSON(path.join(resourcesRoot, 'contents.json'));
        if (content) {
            content.requirejsPaths = requirejsPaths;
            grunt.file.write(path.join(resourcesRoot, 'contents.json'), JSON.stringify(content, null, 2));
            grunt.file.write(path.join(resourcesRoot, 'contents.js'), 'contents = ' + JSON.stringify(content, null, 2));
        }
    } catch (e) {
        grunt.fail.fatal('Can\'t read contents.json file - ' + e);
    }
}

module.exports = function (grunt) {
    grunt.registerMultiTask('requirejsPaths', '', function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача requirejsPaths.');

        var root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application),
            firstLvlDirs = getFirstLevelDirs(applicationRoot),
            requirejsPaths = {};

        firstLvlDirs.forEach(function (dir) {
            dir = path.relative(root, dir).replace(dblSlashes, '/');
            requirejsPaths[dir.split('/').pop()] = dir;
        });
        requirejsPaths.WS = path.relative(root, path.join(applicationRoot, 'ws/')).replace(dblSlashes, '/');

        replaceContents(grunt, requirejsPaths, applicationRoot);

        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача requirejsPaths завершена.');
    });
};