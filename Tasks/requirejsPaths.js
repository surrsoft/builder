"use strict";

var
    path = require('path'),
    fs = require('fs'),
    dblSlashes = /\\/g;

function getFirstLevelDirs(rootPath) {
    var
        resources = path.join(rootPath, 'resources'),
        dirs;

    dirs = fs.readdirSync(resources).map(function (e) {
        return path.join(resources, e);
    });

    return dirs.filter(function (e) {
        return fs.statSync(e).isDirectory();
    });
}

function replaceContents(grunt, keys, subDir) {
    var absolutePath = path.join('./', subDir || '', 'resources/contents.json');
    try {
        var content = grunt.file.readJSON(absolutePath);
        if (content) {
            Object.keys(keys).forEach(function (key) {
                content[key] = keys[key];
            });
            grunt.file.write(absolutePath, JSON.stringify(content, null, 2));
            grunt.file.write(absolutePath.replace('.json', '.js'), 'contents = ' + JSON.stringify(content, null, 2));
        }
    } catch (e) {
        grunt.fail.fatal('Can\'t read contents.json file - ' + e);
    }
}

module.exports = function (grunt) {
    grunt.registerMultiTask('requirejsPaths', '', function () {

        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача requirejsPaths.');

        var
            firstLvlDirs = getFirstLevelDirs(path.join('.', this.data.application)),
            requirejsPaths = {};

        firstLvlDirs.forEach(function (dir) {
            dir = dir.replace(dblSlashes, '/');
            requirejsPaths[dir.split('/').pop()] = dir;
        });

        replaceContents(grunt, {
            requirejsPaths: requirejsPaths
        }, this.data.application);

        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Задача requirejsPaths завершена.');
    });
};