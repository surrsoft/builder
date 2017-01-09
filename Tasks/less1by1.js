const fileWalker = require('./../lib/utils/FileWalker.js'),
    fs = require('fs'),
    path = require('path'),
    less = require('less');

module.exports = function less1by1Task(grunt) {

    grunt.registerMultiTask('less1by1', 'Компилит каждую лесску, ложит cssку рядом. Умеет в темы', function() {

        grunt.log.ok(`${grunt.template.today('hh:MM:ss')} : Запускается задача less1by1.`);
        grunt.log.ok(`Текущая тема: ${grunt.option('theme')}`);

        let root = grunt.option('root') || '',
            app = grunt.option('application') || '',
            rootPath = path.join(root, app),
            taskDone = this.async(),
            theme = grunt.option('theme'),
            lessCompilePromises = [],
            controlsPath = path.join(rootPath, '/resources/SBIS3.CONTROLS/themes/');

        if (!fs.existsSync(controlsPath)) {
            grunt.log.ok('Сервис не использует SBIS3.CONTROLS или что-то пошло не по плану!');
            taskDone();
        }


        function handleError(err) {
            grunt.log.error(err);
        }

        function compileLess(files) {

            files.forEach(function lessFilesIterator(filepath, index) {

                let lessData = fs.readFileSync(filepath).toString();
                lessCompilePromises.push(new Promise(function(resolve, reject) {

                    let imports = theme ?
                        `
                    @import '${controlsPath}${theme}/variables';
                    @import '${controlsPath}mixins';

                    ` : '';
                    less.render(imports + lessData, {
                        filename: filepath,
                        cleancss: false,
                        strictImports: true
                    }, function writeCSS(e, output) {

                        if (e) {
                            reject(e);
                        }

                        let newName = `${path.dirname(filepath)}/${path.basename(filepath, '.less')}.css`;

                        try {
                            grunt.file.write(newName, output.css);
                        } catch (cantWriteFile) {
                            reject(new Error(`Не могу записать файл. Ошибка: ${cantWriteFile.message}.`));
                        }

                        grunt.log.ok(`file ${filepath} successfuly compiled`);
                        resolve('succees!');
                    });
                }));
            });
        };


        fileWalker.walkByFileExt(rootPath, '.less').then(compileLess).then(function() {

            Promise.all(lessCompilePromises).then(function() {

                grunt.log.ok(`${grunt.template.today('hh:MM:ss')} : Задача less1by1 выполнена.`);

            }).then(taskDone);
        }, handleError);
    });

};