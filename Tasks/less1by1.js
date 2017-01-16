'use strict';
const helpers = require('./../lib/utils/helpers'),
    fs = require('fs'),
    path = require('path'),
    humanize = require('humanize'),
    less = require('less'),
    getModuleNameRegExp = new RegExp('\/resources\/([^/]+)');
/**
 @workaround Временно ресолвим текущую тему по названию модуля.
*/
function resolveThemeName(filepath) {

    let regexpMathch = filepath.match(getModuleNameRegExp, ''),
        s3modName = regexpMathch ? regexpMathch[1] : 'smth';

    switch (s3modName) {
        case 'Upravlenie_oblakom':
            return 'cloud';
        case 'Presto':
            return 'presto';
        case 'sbis.ru':
            return 'sbisru';
        case 'Retail':
            return 'carry';
        default:
            return 'online';
    }
}
module.exports = function less1by1Task(grunt) {

    grunt.registerMultiTask('less1by1', 'Компилит каждую лесску, ложит cssку рядом. Умеет в темы', function() {

        grunt.log.ok(`${humanize.date('H:i:s')} : Запускается задача less1by1.`);

        let root = grunt.option('root') || '',
            app = grunt.option('application') || '',
            rootPath = path.join(root, app),
            taskDone = this.async(),
            themesPath = path.join(rootPath, '/resources/SBIS3.CONTROLS/themes/');

        helpers.recurse(rootPath, function(filepath, cb) {

            if (helpers.validateFile(filepath, ['**/*.less'])) {
                fs.readFile(filepath, function readFileCb(readFileError, data) {

                    let lessData = data.toString(),
                        theme = resolveThemeName(filepath),
                        imports = theme ?
                        `
                            @import '${themesPath}${theme}/variables';
                            @import '${themesPath}mixins';

                            ` : '';

                    less.render(imports + lessData, {
                        filename: filepath,
                        cleancss: false,
                        relativeUrls: true,
                        strictImports: true
                    }, function writeCSS(compileLessError, output) {

                        if (compileLessError) {
                            grunt.log.ok(compileLessError);
                        }

                        let newName = `${path.dirname(filepath)}/${path.basename(filepath, '.less')}.css`;
                        if (output) {
                            fs.writeFile(newName, output.css, function writeFileCb(writeFileError) {
                                if (writeFileError) grunt.log.ok(`Не могу записать файл. Ошибка: ${writeFileError.message}.`);
                                grunt.log.ok(`file ${filepath} successfuly compiled. Theme: ${theme}`);
                            });
                        }
                    });
                });
            }

            cb();
        }, function() {
            grunt.log.ok(`${humanize.date('H:i:s')} : Задача less1by1 выполнена.`);
            taskDone();
        });

    });


};