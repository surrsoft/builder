'use strict';

const path = require('path');
const fs = require('fs-extra');
const async = require('async');
const helpers = require('./../lib/utils/helpers');
const transliterate = require('./../lib/utils/transliterate');
const traverse = require('estraverse').traverse;
const humanize = require('humanize');
const spawn = require('child_process').spawn;
const os = require('os');

const dblSlashes = /\\/g;
const isXmlDeprecated = /\.xml\.deprecated$/;
const isHtmlDeprecated = /\.html\.deprecated$/;
const isModuleJs = /\.module\.js$/;

let
    contents = {},
    contentsModules = {},
    xmlContents = {},
    htmlNames = {},
    jsModules = {},
    requirejsPaths = {};

function removeLeadingSlash(path) {
   if (path) {
      var head = path.charAt(0);
      if (head == '/' || head == '\\') {
         path = path.substr(1);
      }
   }
   return path;
}

function getModuleName(tsdModuleName, abspath, input, node) {
    if (node.type == 'CallExpression' && node.callee.type == 'Identifier' &&
        node.callee.name == 'define') {
        //noinspection JSAnnotator
        if (node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
            //noinspection JSAnnotator
            let mod = node.arguments[0].value;
            let parts = mod.split('!');
            if (parts[0] == 'js') {
                jsModules[parts[1]] = path.join(tsdModuleName,
                    transliterate(path.relative(input, abspath))).replace(dblSlashes, '/');
            }
        }
    }
}

module.exports = function (grunt) {
    grunt.registerMultiTask('convert', 'transliterate paths', function () {
        grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача конвертации ресурсов`);
        const start = Date.now();
        const done = this.async();
        const
            symlink = !!grunt.option('symlink'),
            modules = (grunt.option('modules') || '').replace(/"/g, ''),
            service_mapping = grunt.option('service_mapping') || false,
            i18n = !!grunt.option('index-dict'),
            dryRun = grunt.option('dry-run'),
            application = grunt.option('application') || '',
            applicationName = application.replace('/', '').replace(dblSlashes, ''),
            applicationRoot = this.data.cwd,
            resourcesPath = path.join(applicationRoot, 'resources');

        let i = 0;
        let paths = modules.split(';');

        if (paths.length == 1 && grunt.file.isFile(paths[0])) {
            let input = paths[0];
            try {
                paths = grunt.file.readJSON(input);
                if (!Array.isArray(paths)) {
                    grunt.log.error('Parameter "modules" incorrect');
                    return;
                }
            } catch (e) {
                grunt.log.error(`Parameter "modules" incorrect. Can\'t read ${input}`);
                return;
            }
        }

        function copyFile(target, dest, data, cb) {
            let ext = path.extname(target);
            if (!symlink || (i18n && (ext == '.xhtml' || ext == '.html'))) {
                helpers.copyFile(target, dest, data, cb);
            } else {
                helpers.mkSymlink(target, dest, cb);
            }
        }

        function remove(dir) {
            let attempt = 1;
            let start = Date.now();

            (function _remove() {
                try {
                    grunt.log.ok(`${humanize.date('H:i:s')}: Запускается удаление ресурсов(${attempt})`);
                    fs.removeSync(dir);
                    grunt.log.ok(`${humanize.date('H:i:s')}: Удаление ресурсов завершено(${(Date.now() - start) / 1000} sec)`);
                    main();
                } catch (err) {
                    if (++attempt <= 3) {
                        setTimeout(_remove, 1000);
                    } else {
                        grunt.fail.fatal(err);
                    }
                }
            })();
        }

        if (!dryRun) {
            let start = Date.now();
            let out = resourcesPath + '___';

            fs.rename(resourcesPath, out, function (err) {
                if (!err) {
                    grunt.log.ok(`${humanize.date('H:i:s')}: Перенос ресурсов в ${out} завершен(${(Date.now() - start) / 1000} sec)`);

                    let cmd = '';
                    let opt = {
                        detached: true
                    };

                    if (os.platform() == 'linux') {
                        cmd = `rm -rf ${out}`;
                    } else {
                        cmd = `rmdir ${out} /s /q`;
                        opt.shell = true;
                    }

                    grunt.log.ok(`${humanize.date('H:i:s')}: Запускается удаление ресурсов(${cmd})`);

                    spawn(cmd, [], opt).on('error', (err) => {
                        console.error(err);
                    }).on('close', () => {
                        grunt.log.ok(`${humanize.date('H:i:s')}: Удаление ресурсов завершено(${(Date.now() - start) / 1000} sec)`);
                    }).unref();

                    main();
                } else {
                    remove(resourcesPath);
                }
            });
        } else {
            main();
        }

        function main() {
            async.eachSeries(paths, function (input, callback) {
                let parts = input.replace(dblSlashes, '/').split('/');
                let moduleName = parts[parts.length - 1];
                let tsdModuleName = transliterate(moduleName);
               if (applicationName == tsdModuleName) {
                  grunt.fail.fatal('Имя сервиса и имя модуля облака не должны совпадать. Сервис: ' + applicationName, '; Модуль: ' + tsdModuleName)
               }
                contentsModules[moduleName] = tsdModuleName;
                requirejsPaths[tsdModuleName] = removeLeadingSlash(path.join(application, 'resources', tsdModuleName).replace(dblSlashes, '/'));

                helpers.recurse(input, function (file, callback) {
                    let dest = path.join(resourcesPath, tsdModuleName,
                        transliterate(path.relative(input, file)));

                    if (isXmlDeprecated.test(file)) {
                        let basexml = path.basename(file, '.xml.deprecated');
                        xmlContents[basexml] = path.join(tsdModuleName,
                            transliterate(path.relative(input, file).replace('.xml.deprecated', ''))).replace(dblSlashes, '/');

                        if (!dryRun) {
                            copyFile(file, dest, null, callback);
                        }
                    } else if (isHtmlDeprecated.test(file)) {
                        let basehtml = path.basename(file, '.deprecated');
                        let parts = basehtml.split('#');
                        htmlNames[parts[0]] = (parts[1] || parts[0]).replace(dblSlashes, '/');

                        if (!dryRun) {
                            copyFile(file, dest, null, callback);
                        }
                    } else if (isModuleJs.test(file)) {
                        fs.readFile(file, function (err, text) {
                            let ast = helpers.parseModule(text.toString());

                            if (ast instanceof Error) {
                                console.log(`------------------------ Bad file: ${file}`, ast);
                                grunt.fail.fatal(file, ast);
                                return callback(ast);
                            }

                            traverse(ast, {
                                enter: function (node) {
                                    getModuleName(tsdModuleName, file, input, node);
                                }
                            });
                            if (!dryRun) {
                                copyFile(file, dest, text, callback);
                            }
                        });
                    } else if (!dryRun) {
                        copyFile(file, dest, null, callback);
                    }
                }, function () {
                    grunt.log.ok(`[${helpers.percentage(++i, paths.length)}%] ${input}`);
                    callback();
                });
            }, function (err) {
                if (err) {
                    return grunt.fail.fatal(err);
                }

                try {
                    contents.modules = contentsModules;
                    contents.xmlContents = xmlContents;
                    contents.jsModules = jsModules;
                    contents.htmlNames = htmlNames;

                    requirejsPaths.WS = removeLeadingSlash(path.join(application, 'ws/').replace(dblSlashes, '/'));

                    contents.requirejsPaths = requirejsPaths;

                    if (service_mapping) {
                        let srv_arr = service_mapping.trim().split(' ');
                        if (srv_arr.length % 2 == 0) {
                            let services = {};
                            for (let i = 0; i < srv_arr.length; i += 2) {
                                services[srv_arr[i]] = srv_arr[i + 1];
                            }
                            contents.services = services;
                        } else {
                            grunt.fail.fatal('Services list must be even!');
                        }
                    }

                    let sorted = helpers.sortObject(contents);

                    grunt.file.write(path.join(resourcesPath, 'contents.json'), JSON.stringify(sorted, null, 2));
                    grunt.file.write(path.join(resourcesPath, 'contents.js'), 'contents=' + JSON.stringify(sorted));
                } catch (err) {
                    grunt.fail.fatal(err);
                }

                console.log(`Duration: ${(Date.now() - start) / 1000} sec`);
                done();
            });
        }
    });
};