'use strict';

const path = require('path');
const fs = require('fs');
const humanize = require('humanize');
const async = require('async');
const tmplLocalizator = require('./../lib/i18n/tmplLocalizator');
const walkFolder = require('./../lib/utils/walkFolder');
const Deferred = global.requirejs('Core/Deferred');

function warnTmplBuild(err, fullPath) {
    grunt.log.warn(`resources error. An ERROR occurred while building template! ${err.message}, in file: ${fullPath}`);
}

function errorTmplBuild(err, fullName, fullPath) {
    grunt.log.error(`Resources error. An ERROR occurred while building template!
    ---------File name: ${fullName}
    ---------File path: ${fullPath}`);
    grunt.fail.fatal(err);
}

function stripBOM(x) {
    if (x.charCodeAt(0) === 0xFEFF) {
        return x.slice(1);
    }

    return x;
}

module.exports = function (grunt) {
    grunt.registerMultiTask('html-build', 'Generate markup for .html.tmpl files', function () {
        grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача html-build.`);
        const
            done = this.async(),
            root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application);

        let deps = ['Core/tmpl/tmplstr', 'Core/tmpl/config', 'optional!Core/tmpl/js/tclosure'];

        global.requirejs(deps, function (tmpl, config, tclosure) {
            if (tclosure) {
                deps.push('Core/tmpl/js/tclosure');
            }
            var resultDef = walkFolder(applicationRoot, function (folder, fileName, html) {
                var def = new Deferred();
                let conf = {config: config, filename: ''};

                var templateRender = Object.create(tmpl);
                var fullPath = path.join(folder, fileName);

                html = stripBOM(html);

                if (html.indexOf('define') === 0) {
                    def.errback(new Error(fullPath + ' - не шаблон!'));
                    return;
                }

                try {
                    tmplLocalizator.parseTmpl(grunt, html, fullPath).addCallback(function (traversedObj) {
                        const traversed = traversedObj.astResult;
                        try {
                            let tmplFunc = templateRender.func(traversed, conf);
                            var resHtml = tmplFunc({}, {}, undefined, false, undefined, tclosure);

                            var newFullPath = fullPath.replace(/\.tmpl$/, '');
                            // если файл уже есть, удалим
                            if (fs.existsSync(newFullPath)) {
                                fs.unlinkSync(newFullPath);
                            }
                            // создадим файл с новым содержимым
                            fs.writeFileSync(newFullPath, resHtml.toString(), {
                                flag: "wx"
                            });
                            def.callback();
                        } catch (err) {
                            warnTmplBuild(err, fullPath);
                            def.errback(err);
                        }
                    }).addErrback(function (err) {
                        warnTmplBuild(err, fullPath);
                        def.errback(err);
                    });
                } catch(err) {
                    errorTmplBuild(err, fileName, fullPath);
                    def.errback(err);
                }
                return def;
            });

            resultDef.addCallback(function () {
                done();
            }).addErrback(function (err) {
                console.error(err);
                done();
            });
        });
    });
};
