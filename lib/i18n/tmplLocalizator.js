var path = require('path');
var fs = require('fs');
var Deferred = global.requirejs('Core/Deferred');
const tmplParser = global.requirejs('View/Builder/Tmpl');
const configModule = global.requirejs('View/config');
const resolverControls = function resolverControls(path) {
    return 'tmpl!' + path;
};
//const argv  = require('yargs').argv;
//const nlog = require('../logger-native');
function warning (err, filePath) {
    nlog.warn('gulp-sbis-tmpl-build:', 'Tmpl Localization', 'error in file', filePath, err.message);
}

var grunt;

var jsonLoaded = false;
function readAllJSON(directory) {
    /**
     * Вычитывает файл со свойствами контрола
     * @param {String} file - название контрола
     */
    function readPropertiesJSON(fileObj) {
        var properties = {};
        var modPath = path.join(fileObj.path, fileObj.file);

        if (fs.existsSync(modPath)) {
            try {
                properties = require(modPath);// grunt.file.readJSON(modPath);
            } catch (e) {
                if (grunt) { // заглушка для gulp
                    grunt.log.error('Can\'t read ' + modPath);
                } else {
                    warning(e, modPath);
                }

            }
        }
        return properties;
    }

    // List all files in a directory in Node.js recursively in a synchronous fashion
    var walkSync = function (dir, filelist) {
        var path = path || require('path');
        var fs = fs || require('fs'),
            files = fs.readdirSync(dir);
        filelist = filelist || [];
        files.forEach(function (file) {
            if (fs.statSync(path.join(dir, file)).isDirectory()) {
                filelist = walkSync(path.join(dir, file), filelist);
            }
            else {
                filelist.push({path: dir, file: file});
            }
        });
        return filelist;
    };

    if (!jsonLoaded) {

        var files = walkSync(directory);

        var componentsProperties = [],
            tmpProperties;
        files.forEach(function (fileObj) {
            var fileName = fileObj.file.replace(/\.json$/g, '');
            tmpProperties = readPropertiesJSON(fileObj);
            if (tmpProperties.properties &&
                tmpProperties.properties["ws-config"] &&
                tmpProperties.properties["ws-config"].options) {

                componentsProperties[fileName] = tmpProperties;
            }
        });

        jsonLoaded = componentsProperties;
        return componentsProperties;
    } else {
        return jsonLoaded;
    }
}

function parseTmpl(_grunt, tmplMarkup, currentPath) {
    grunt = _grunt;
    var def = new Deferred();

    let cache;
    if (_grunt) { // заглушка для gulp
        cache = grunt.option('json-cache') && grunt.option('json-cache').replace(/"/g, '');
    } else {
       // cache = argv['json-cache'] && argv['json-cache'].replace(/"/g, '');
    }
    const jsonOutput = cache || path.join(__dirname, '../../../../jsDoc-json-cache');
    var componentsProperties = [];

    try {
       componentsProperties = readAllJSON(jsonOutput);
    }catch(e){
    }
    tmplParser.template(tmplMarkup, resolverControls, {
        config: configModule,
        filename: currentPath,
        fromBuilderTmpl: true,
        createResultDictionary: true,
        componentsProperties: componentsProperties
    }).handle(function (traversedObj) {
        def.callback(traversedObj);
    }, function (error) {
        if (_grunt) { // заглушка для gulp
            grunt.log.error(error.message);
        } else {
            warning(error, currentPath);
        }
        def.errback(error);
    });

    return def;
}

module.exports = {
    parseTmpl: parseTmpl
};