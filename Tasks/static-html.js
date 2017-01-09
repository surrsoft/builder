'use strict';

const path = require('path');
const fs = require('fs');
const esprima = require('esprima');
const traverse = require('estraverse').traverse;
const transliterate = require('./../lib/utils/transliterate');
const replaceIncludes = require('./../lib/utils/include-replacer');
const humanize = require('humanize');
const async = require('async');
const minimatch = require('minimatch');
const mkdirp = require('mkdirp');

const dblSlashes = /\\/g;

let cache = {};

function parseModule(module) {
    let res;
    try {
        res = esprima.parse(module);
    } catch (e) {
        res = e;
    }
    return res;
}

function findExpression(node, left) {
    return node.type == 'ExpressionStatement' && node.expression.type == 'AssignmentExpression' &&
        node.expression.operator == '=' && node.expression.left.type == 'MemberExpression' &&
        node.expression.left.property.name == left && node.expression.left.object &&
        node.expression.left.object.type == 'Identifier';
}

function parseObjectExpression(properties) {
    let obj = {};
    properties.forEach(function (prop) {
        obj[prop.key.name] = prop.value.value;
    });
    return obj;
}

function recurse(applicationRoot, input, patterns, fn, cb) {
    fs.readdir(input, function (err, files) {
        if (!err) {
            async.eachLimit(files, 10, function (file, cb) {
                let abspath = path.join(input, file);

                fs.lstat(abspath, function (err, stats) {
                    if (!err) {
                        if (stats.isDirectory()) {
                            recurse(applicationRoot, abspath, patterns, fn, cb);
                        } else {
                            let passed = true;
                            let tmp = path.relative(applicationRoot, abspath);

                            for (let i = 0; i < patterns.length; i++) {
                                if (!minimatch(tmp, patterns[i])) {
                                    passed = false;
                                    break;
                                }
                            }

                            if (passed) {
                                fn(abspath, cb);
                            } else {
                                cb();
                            }
                        }
                    } else {
                        cb(err);
                    }
                });
            }, function (err) {
                if (err) {
                    console.error(err);
                }
                cb();
            });
        }
    });
}

function _writeFile(dest, data, cb) {
    let options = {flag: 'w'};

    let writeFile = function (dest, data, options, cb) {
        fs.writeFile(dest, data, options, function (err) {
            if (err && err.code === 'ENOENT') {
                mkdirp(path.dirname(dest), function (err) {
                    if (!err || err.code === 'EEXIST') {
                        writeFile(dest, data, options, cb);
                    } else {
                        console.log(`[ERROR]: ${err}`);
                        cb();
                    }
                });
            } else if (err) {
                console.log(`[ERROR]: ${err}`);
                cb();
            } else {
                cb();
            }
        });
    };

    writeFile(dest, data, options, cb);
}

module.exports = function (grunt) {
    const srvPath = (grunt.option('services_path') || '').replace(/"|'/g, '');
    const userParams = grunt.option('user_params') || false;
    const globalParams = grunt.option('global_params') || false;
    let htmlNames = {};

    function getReplaceOpts(root, application) {
        return {
            WINDOW_TITLE: '',
            APPEND_STYLE: '',
            APPEND_JAVASCRIPT: '',
            ACCESS_LIST: '',
            APPLICATION_ROOT: application,
            SBIS_ROOT: application + 'ws/',
            RESOURCE_ROOT: application + 'resources/',
            SERVICES_PATH: srvPath || application + 'service/sbis-rpc-service300.dll',
            USER_PARAMS: userParams,
            GLOBAL_PARAMS: globalParams,
            SAVE_LAST_STATE: false,
            ROOT: root,
            START_DIALOG: ''
        }
    }

    function generateHTML(htmlTemplate, outFileName, replaceOpts, applicationRoot, cb) {
        let templatePath = '';
        if (!htmlTemplate) {
            templatePath = path.join(__dirname, './../resources/index.html');
            console.log(templatePath);
        } else {
            templatePath = path.join(applicationRoot, 'resources', htmlTemplate);
        }

        if (cache[templatePath]) {
            let text = replaceIncludes(cache[templatePath], replaceOpts);
            _writeFile(path.join(applicationRoot, outFileName), text, cb);
        } else {
            fs.readFile(templatePath, (err, text) => {
                if (err) {
                    grunt.fail.fatal(err);
                    return cb(err);
                }

                cache[templatePath] = text.toString();
                text = replaceIncludes(cache[templatePath], replaceOpts);
                _writeFile(path.join(applicationRoot, outFileName), text, cb);
            });
        }
    }

    function parseOpts(opts, application, replaceOpts, applicationRoot, cb) {
        let
            moduleName = opts.moduleName,
            webPage = opts.webPage || {},
            htmlTemplate = webPage.htmlTemplate || '',
            outFileName = webPage.outFileName;
        replaceOpts.WINDOW_TITLE = opts.title || '';
        replaceOpts.START_DIALOG = moduleName || '';

        if (!outFileName) {
            return cb();
        } else if (!htmlTemplate) {
            grunt.log.warn(`Using default template for output file ${outFileName}.html`);
        } else if (!(htmlTemplate.indexOf('Тема Скрепка') > -1 || htmlTemplate.indexOf('Tema_Skrepka') > -1)) {
            grunt.log.warn('HTML Template is not from Tema_Skrepka(Тема Cкрепка)', htmlTemplate);
        }

        htmlNames[moduleName] = application.replace('/', '') + outFileName + '.html';

        htmlTemplate = transliterate(htmlTemplate.replace(dblSlashes, '/'));

        generateHTML(htmlTemplate, outFileName + '.html', replaceOpts, applicationRoot, cb);
    }

    grunt.registerMultiTask('static-html', 'Generate static html from modules', function () {
        grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача static-html.`);
        let start = Date.now();
        const
            done = this.async(),
            root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application),
            resourcesRoot = path.join(applicationRoot, 'resources'),
            patterns = this.data.src,
            oldHtml = grunt.file.expand({cwd: applicationRoot}, this.data.html);

        let contents = {};

        try {
            contents = grunt.file.readJSON(path.join(resourcesRoot, 'contents.json'));
            htmlNames = contents.htmlNames || {};
        } catch (err) {
            grunt.log.warn('Error while requiring contents.json', err);
        }

        if (oldHtml && oldHtml.length) {
            let start = Date.now();
            oldHtml.forEach(function (file) {
                const filePath = path.join(applicationRoot, file);
                try {
                    fs.unlinkSync(path.join(applicationRoot, file));
                } catch (err) {
                    console.log('Can\'t delete old html: ', filePath, err);
                }
            });
            grunt.log.ok(`${humanize.date('H:i:s')}: Удаление ресурсов завершено(${(Date.now() - start) / 1000} sec)`);
        }

        recurse(applicationRoot, applicationRoot, patterns, function (file, callback) {
            fs.readFile(file, (err, text) => {
                if (err) {
                    grunt.fail.fatal(err);
                    return callback(err);
                }

                let ast = parseModule(text.toString());

                if (ast instanceof Error) {
                    ast.message += '\nPath: ' + file;
                    grunt.fail.fatal(ast);
                    return callback(ast);
                }

                let arrExpr = [];
                let ReturnStatement = null;
                let moduleName = '';

                traverse(ast, {
                    enter: function getModuleName(node) {
                        if (findExpression(node, 'webPage') && node.expression.right && node.expression.right.type == 'ObjectExpression') {
                            arrExpr.push(node.expression);
                        }

                        if (findExpression(node, 'title') && node.expression.right && node.expression.right.type == 'Literal') {
                            arrExpr.push(node.expression);
                        }

                        if (node.type == 'CallExpression' && node.callee.type == 'Identifier' &&
                            node.callee.name == 'define') {
                            if (node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
                                moduleName = node.arguments[0].value;
                            }

                            let fnNode = null;
                            if (node.arguments[1] && node.arguments[1].type == 'FunctionExpression') {
                                fnNode = node.arguments[1].body;
                            } else if (node.arguments[2] && node.arguments[2].type == 'FunctionExpression') {
                                fnNode = node.arguments[2].body;
                            }
                            if (fnNode) {
                                if (fnNode.body && fnNode.body instanceof Array) {
                                    fnNode.body.forEach(function (i) {
                                        if (i.type == 'ReturnStatement') {
                                            ReturnStatement = i.argument;
                                        }
                                    });
                                }
                            }
                        }
                    }
                });

                if (arrExpr.length && ReturnStatement) {
                    let opts = {};
                    opts.moduleName = moduleName;
                    arrExpr.forEach(function (expr) {
                        try {
                            expr.left.object.name == ReturnStatement.name ? opts[expr.left.property.name] =
                                    expr.right.type == 'ObjectExpression' ? parseObjectExpression(expr.right.properties)
                                        : expr.right.value : false;
                        } catch (err) {
                            grunt.log.error(err);
                        }
                    });

                    parseOpts(opts, application, getReplaceOpts(root, application), applicationRoot, callback);
                } else {
                    callback();
                }
            });
        }, function (err) {
            if (err) {
                grunt.fail.fatal(err);
            }

            try {
                contents.htmlNames = htmlNames;

                grunt.file.write(path.join(resourcesRoot, 'contents.json'), JSON.stringify(contents, null, 2));
                grunt.file.write(path.join(resourcesRoot, 'contents.js'), 'contents=' + JSON.stringify(contents));
            } catch (err) {
                grunt.fail.fatal(err);
            }

            console.log(`Duration: ${(Date.now() - start) / 1000} sec`);

            done();
        });

    });

    grunt.registerMultiTask('xml-deprecated', 'Convert deprecated xml', function () {
        grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача xml-deprecated.`);
        const start = Date.now();
        const
            done = this.async(),
            root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application),
            patterns = this.data.src;

        recurse(applicationRoot, applicationRoot, patterns, function (file, callback) {
            fs.readFile(file, (err, text) => {
                if (err) {
                    grunt.fail.fatal(err);
                    return callback(err);
                }

                text = replaceIncludes(text.toString(), getReplaceOpts(root, application));
                fs.unlink(file, () => {});
                _writeFile(file.replace('.deprecated', ''), text, callback);
            });
        }, function (err) {
            if (err) {
                grunt.fail.fatal(err);
            }

            console.log(`Duration: ${(Date.now() - start) / 1000} sec`);
            done();
        });
    });

    grunt.registerMultiTask('html-deprecated', 'Convert deprecated html', function () {
        grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача html-deprecated.`);
        const start = Date.now();
        const
            done = this.async(),
            root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application),
            patterns = this.data.src;

        recurse(applicationRoot, applicationRoot, patterns, function (file, callback) {
            const parts = file.split('#');
            const basename = path.basename(parts[1] || parts[0], '.deprecated');

            fs.readFile(file, (err, text) => {
                if (err) {
                    grunt.fail.fatal(err);
                    return callback(err);
                }

                text = replaceIncludes(text.toString(), getReplaceOpts(root, application));
                fs.unlink(file, () => {});
                _writeFile(path.join(applicationRoot, basename), text, callback);
            });
        }, function (err) {
            if (err) {
                grunt.fail.fatal(err);
            }

            console.log(`Duration: ${(Date.now() - start) / 1000} sec`);
            done();
        });
    });
};