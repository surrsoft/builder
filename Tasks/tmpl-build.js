'use strict';

const path = require('path');
const fs = require('fs');
const helpers = require('./../lib/utils/helpers');
const humanize = require('humanize');
const async = require('async');
const DoT = global.requirejs('Core/js-template-doT');
const UglifyJS = require('uglify-js');
const tmplLocalizator = require('./../lib/i18n/tmplLocalizator');
const dblSlashes = /\\/g;
const isTMPL = /(\.tmpl)$/;
const isHTML = /(\.x?html)$/;

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
    grunt.registerMultiTask('tmpl-build', 'Generate static html from modules', function () {
        grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача tmpl-build.`);
        let start = Date.now();
        const
            done = this.async(),
            root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application),
            mDeps = JSON.parse(fs.readFileSync(path.join(applicationRoot, 'resources', 'module-dependencies.json'))),
            nodes = mDeps.nodes;

        let deps = ['Core/tmpl/tmplstr', 'Core/tmpl/config'];

        global.requirejs(deps.concat(['optional!Core/tmpl/js/tclosure']), function (tmpl, config, tclosure) {
            let tclosureStr = '';
            if (tclosure) {
                deps.push('Core/tmpl/js/tclosure');
                tclosureStr = 'var tclosure=deps[0];';
            }

            async.eachOfLimit(nodes, 50, function (value, fullName, callback) {
                if (fullName.indexOf('tmpl!') == 0) {
                    let filename = value.path.replace(dblSlashes, '/'),
                        fullPath = path.join(applicationRoot, filename).replace(dblSlashes, '/'),
                        _deps = JSON.parse(JSON.stringify(deps)),
                        result = ['var templateFunction = '];
                    if (value.amd) {
                        return setImmediate(callback);
                    }


                    let conf = {config: config, filename: filename, fromBuilderTmpl: true};
                    fs.readFile(fullPath, 'utf8', function (err, html) {
                        if (err) {
                            console.log(`Potential 404 error: ${err}`);
                            warnTmplBuild(err, fullPath);
                            return callback();
                        }

                        var templateRender = Object.create(tmpl);

                        let original = html;
                        html = stripBOM(html);

                        if (html.indexOf('define') == 0) {
                            return callback();
                        }

                        try {
                            templateRender.getComponents(html).forEach(function (dep) {
                                _deps.push(dep);
                            });

                            tmplLocalizator.parseTmpl(grunt, html, filename).addCallback(function (traversedObj) {
                                const traversed = traversedObj.astResult;
                                try {
                                    if (traversed.__newVersion === true) {
                                        /**
                                         * Новая версия рендера, для шаблонизатора. В результате функция в строке.
                                         */
                                        let tmplFunc = templateRender.func(traversed, conf);
                                        result.push(tmplFunc.toString() + ';');

                                        if (tmplFunc.includedFunctions) {
                                            result.push('templateFunction.includedFunctions = {');
                                            /*Сократим размер пакета, т.к. функции сейчас генерируются в опциях
                                             Но оставим определение, т.к. возможны обращения к свойству внутри WS
                                             Object.keys(tmplFunc.includedFunctions).forEach(function (elem, index, array) {
                                             result.push('"' + elem + '": ' + tmplFunc.includedFunctions[elem]);
                                             if (index !== array.length - 1) {
                                             result.push(',');
                                             }
                                             });
                                             */
                                            result.push('};');
                                        }
                                    } else {
                                        result.push('function loadTemplateData(data, attributes) {');
                                        result.push('return tmpl.html(' + JSON.stringify(traversed) + ', data, {config: config, filename: "' + fullName + '"}, attributes);};');
                                    }

                                    result.push('templateFunction.stable = true;');
                                    result.push('templateFunction.toJSON = function() {return {$serialized$: "func", module: "' + fullName + '"}};');
                                    result.push('return templateFunction;');

                                    _deps.splice(0, 2);
                                    let
                                        depsStr = 'var _deps = {};',
                                        i = tclosure ? 1 : 0;
                                    for (; i < _deps.length; i++) {
                                        depsStr += '_deps["' + _deps[i] + '"] = deps[' + i + '];';
                                    }
                                    let data = `define("${fullName}",${JSON.stringify(_deps)},function(){var deps=Array.prototype.slice.call(arguments);${tclosureStr + depsStr + result.join('')}});`;

                                   try {
                                      let minified = UglifyJS.minify(data, { mangle: { eval: true } });
                                      if (!minified.error && minified.code) data = minified.code;
                                   } catch (minerr) {
                                      grunt.log.warn(`resources error. An ERROR occurred while minifying template! ${minerr.message}, in file: ${fullPath}`);
                                   }
                                    fs.writeFile(fullPath.replace(isTMPL, '.original$1'), original, function () {
                                        fs.writeFile(fullPath, data, function (err) {
                                            if (!err) {
                                                nodes[fullName].amd = true;
                                            }
                                            callback(err, fullName, fullPath);
                                        });
                                    });
                                } catch (err) {
                                    warnTmplBuild(err, fullPath);
                                    callback();
                                }
                            }).addErrback(function (err) {
                                warnTmplBuild(err, fullPath);
                                callback();
                            });
                        } catch(err) {
                            errorTmplBuild(err, fullName, fullPath);
                        }
                    });
                } else {
                    setImmediate(callback);
                }
            }, function (err, fullName, fullPath) {
                if (err) {
                    errorTmplBuild(err, fullName, fullPath);
                }

                try {
                    mDeps.nodes = nodes;
                    grunt.file.write(path.join(applicationRoot, 'resources', 'module-dependencies.json'), JSON.stringify(mDeps, null, 2));
                } catch (err) {
                    grunt.fail.fatal(err);
                }

                console.log(`Duration: ${(Date.now() - start) / 1000} sec`);

                done();
            });
        });
    });

    grunt.registerMultiTask('xhtml-build', 'Generate static html from modules', function () {
        grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача xhtml-build.`);
        let start = Date.now();
        const
            oldToNew = require('../resources/old_to_new.json'),
            done = this.async(),
            root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application),
            mDeps = JSON.parse(fs.readFileSync(path.join(applicationRoot, 'resources', 'module-dependencies.json'))),
            nodes = mDeps.nodes;

        async.eachOfLimit(nodes, 20, function (value, fullName, callback) {
            if (fullName.indexOf('html!') == 0) {
                let filename = value.path.replace(dblSlashes, '/'),
                    fullPath = path.join(applicationRoot, filename).replace(dblSlashes, '/');

                if (value.amd) {
                    return callback();
                }

                fs.readFile(fullPath, 'utf8', function (err, html) {
                    if (err) {
                        console.log(`Potential 404 error: ${err}`);
                        warnTmplBuild(err, fullPath);
                        return callback();
                    }

                    let original = html;
                    html = stripBOM(html);

                    if (html.indexOf('define') == 0) {
                        return callback();
                    }

                    try {
                        let config, template;

                        config = DoT.getSettings();

                        if (module.encode) {
                            config.encode = config.interpolate;
                        }

                        template = DoT.template(html, config);

                        //TODO на время переходного периода при отказе от contents.json
                       /* При компиляции из xhtml в js у нас билдяться со старыми именами и в результате по новому имени
                       шаблон уже не доступен. Поэтому здесь проверяем, чтобы старые имена не были заюзаны. Для этого
                       создали список модулей которые подверглись переименованию и проверяем есть ли данный шаблон в списке.
                        https://online.sbis.ru/opendoc.html?guid=f11afc8b-d8d2-462f-a836-a3172c7839a3
                        */
                        let
                           needPushJs = false,
                           nameNotPlugin = fullName.substr(fullName.lastIndexOf('!') + 1),
                           plugin = fullName.substr(0, fullName.lastIndexOf('!') + 1),
                           jsPath,
                           jsModule,
                           secondName;


                        for (var name in oldToNew) {
                            if (name === nameNotPlugin && oldToNew[name] !== nameNotPlugin) {
                               secondName = fullName;
                               nameNotPlugin = oldToNew[name];
                               fullName = plugin + oldToNew[name];
                               break;
                            }
                            if (oldToNew[name] === nameNotPlugin && nameNotPlugin !== name) {
                               secondName = plugin + name;
                               break;
                            }
                        }

                        if (nodes.hasOwnProperty(nameNotPlugin)) {
                           needPushJs = true;
                           jsPath = path.join(applicationRoot, nodes[nameNotPlugin].path).replace(dblSlashes, '/');
                           jsModule = fs.readFileSync(jsPath);
                        }

                        let data = `define("${fullName}",function(){var f=${template.toString().replace(/[\n\r]/g, '')};f.toJSON=function(){return {$serialized$:"func", module:"${fullName}"}};return f;});`;

                        if (secondName) {
                           data += `define("${secondName}",["require"],function(require){require("${fullName}");});`;
                        }

                       //TODO костыль на время переходного периода при отказе от contents.json
                        /*
                         В резудьтате отказа от плагина js! и переименования модулей возникла гонка,
                         require дефайнит и модуль, и шаблон под одним именем, но так как в шаблоне нет js модуля он
                         считает, что модуля по данному имени нет. Временным решением принято дефайнить js в шаблоне,
                         чтобы если первым прелетит шаблон, модуль был найден.
                         https://online.sbis.ru/opendoc.html?guid=bcedfcf8-494d-451e-92f9-d9144e11ecac
                         */
                        if (needPushJs) {
                           data += jsModule;
                        }

                        let minified = UglifyJS.minify(data);
                        if (!minified.error && minified.code) data = minified.code;

                        fs.writeFile(fullPath.replace(isHTML, '.original$1'), original, function () {
                            fs.writeFile(fullPath, data, function (err) {
                                if (!err) {
                                    nodes[fullName].amd = true;
                                    if (nodes[secondName]) {
                                       nodes[secondName].amd = true;
                                    }
                                }
                                callback(err, fullName, fullPath);
                            });
                        });
                    } catch (err) {
                        warnTmplBuild(err, fullPath);
                        callback();
                    }
                });
            } else {
                callback();
            }
        }, function (err, fullName, fullPath) {
            if (err) {
                errorTmplBuild(err, fullName, fullPath);
            }

            try {
                mDeps.nodes = nodes;
                grunt.file.write(path.join(applicationRoot, 'resources', 'module-dependencies.json'), JSON.stringify(mDeps, null, 2));
            } catch (err) {
                grunt.fail.fatal(err);
            }

            console.log(`Duration: ${(Date.now() - start) / 1000} sec`);

            done();
        });
    });
};
