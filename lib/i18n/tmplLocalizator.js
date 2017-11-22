var path = require('path');
var fs = require('fs');
var Deferred = global.requirejs('Core/Deferred');
const tmplParser = global.requirejs('Core/tmpl/tmplstr');
const configModule = global.requirejs('Core/tmpl/config');
const resolverControls = function resolverControls(path) {
    return 'tmpl!' + path;
};
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
                grunt.log.error('Can\'t read ' + modPath);
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

    const cache = grunt.option('json-cache') && grunt.option('json-cache').replace(/"/g, '');
    const jsonOutput = cache || path.join(__dirname, '../../../../jsDoc-json-cache');
    var componentsProperties = [];

    try {
       componentsProperties = readAllJSON(jsonOutput);
    }catch(e){
       grunt.log.warn("Tmpl Localization", e.message);
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
        grunt.log.error(error.message);
        def.errback(error);
    });

    return def;
}

module.exports = {
    parseTmpl: parseTmpl
};