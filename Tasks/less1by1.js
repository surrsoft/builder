const fileWalker = require('./../lib/utils/FileWalker'),
    fs = require('fs'),
    path = require('path'),
    humanize = require('humanize'),
    less = require('less');

module.exports = function less1by1Task(grunt) {

    grunt.registerMultiTask('less1by1', 'Компилит каждую лесску, ложит cssку рядом. Умеет в темы', function() {

        grunt.log.ok(`${humanize.date('H:i:s')} : Запускается задача less1by1.`);

        let root = grunt.option('root') || '',
            app = grunt.option('application') || '',
            rootPath = path.join(root, app),
            taskDone = this.async(),
            theme = grunt.option('theme'),
            lessCompilePromises = [],
            themesPath = path.join(rootPath, '/resources/SBIS3.CONTROLS/themes/');

        // if (!fs.existsSync(controlsPath)) {
        //     grunt.log.ok('Сервис не использует SBIS3.CONTROLS или что-то пошло не по плану!');
        //     taskDone();
        // }
        grunt.log.ok(`Текущая тема: ${grunt.option('theme')}`);

        function handleError(err) {
            grunt.log.error(err);
        }

        function compileLess(files) {


            files.forEach(function lessFilesIterator(filepath, index) {

                lessCompilePromises.push(new Promise(function(resolve, reject) {

                    fs.readFile(filepath, function(readFileError, data) {

                        let lessData = data.toString();


                        let imports = theme ?
                            `
                            @import '${themesPath}${theme}/variables';
                            @import '${themesPath}mixins';

                            ` : '';

                        less.render(imports + lessData, {
                            filename: filepath,
                            cleancss: false,
                            strictImports: true
                        }, function writeCSS(compileLessError, output) {

                            if (compileLessError) {
                                reject(compileLessError);
                            }

                            let newName = `${path.dirname(filepath)}/${path.basename(filepath, '.less')}.css`;
                            if (output) {
                                fs.writeFile(newName, output.css, function writeFileCb(writeFileError) {
                                    if (writeFileError) reject(new Error(`Не могу записать файл. Ошибка: ${writeFileError.message}.`));
                                    grunt.log.ok(`file ${filepath} successfuly compiled`);
                                    resolve('succees!');
                                });
                            } else {
                                reject(new Error('no output'))
                            }

                        });
                    });
                }));
            });
        }

        fileWalker.walkByFileExt(rootPath, '.less').then(compileLess).then(function() {

            Promise.all(lessCompilePromises).then(function() {

                grunt.log.ok(`${humanize.date('H:i:s')} : Задача less1by1 выполнена.`);

            }).then(taskDone);
        }, handleError);
    });

};