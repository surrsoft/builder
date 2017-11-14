'use strict';

const path = require('path');
const fs = require('fs');
const traverse = require('estraverse').traverse;
const transliterate = require('./../lib/utils/transliterate');
const replaceIncludes = require('./../lib/utils/include-replacer');
const helpers = require('./../lib/utils/helpers');
const humanize = require('humanize');
const async = require('async');

const dblSlashes = /\\/g;

let cache = {};

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
            SERVICES_PATH: srvPath || application + 'service/',
            USER_PARAMS: userParams,
            GLOBAL_PARAMS: globalParams,
            SAVE_LAST_STATE: false,
            ROOT: root,
            START_DIALOG: ''
        };
    }

    function generateHTML(htmlTemplate, outFileName, replaceOpts, applicationRoot, cb, inclReplace) {
        let templatePath = '';
        if (!htmlTemplate) {
            templatePath = path.join(__dirname, './../resources/index.html');
            console.log(templatePath);
        } else {
            templatePath = path.join(applicationRoot, 'resources', htmlTemplate);
        }

        if (cache[templatePath]) {
            let text = replaceIncludes(cache[templatePath], replaceOpts, inclReplace);
            helpers.writeFile(path.join(applicationRoot, outFileName), text, cb);
        } else {
            fs.readFile(templatePath, (err, text) => {
                if (err) {
                    grunt.fail.fatal(err);
                    return cb(err);
                }

                cache[templatePath] = text.toString();
                text = replaceIncludes(cache[templatePath], replaceOpts, inclReplace);
                helpers.writeFile(path.join(applicationRoot, outFileName), text, cb);
            });
        }
    }

    function parseOpts(opts, application, replaceOpts, applicationRoot, cb, inclReplace) {
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
            grunt.log.ok(`Using default template for output file ${outFileName}.html`);
        }

        htmlNames[moduleName] = application.replace('/', '') + outFileName + '.html';

        htmlTemplate = transliterate(htmlTemplate.replace(dblSlashes, '/'));

        generateHTML(htmlTemplate, outFileName + '.html', replaceOpts, applicationRoot, cb, inclReplace);
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
            oldHtml = grunt.file.expand({cwd: applicationRoot}, this.data.html),
            inclReplace =  (grunt.option('includes') !== undefined) ? grunt.option('includes') : true;

        console.log(inclReplace);

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

        helpers.recurse(applicationRoot, function (file, callback) {
            if (helpers.validateFile(path.relative(applicationRoot, file), patterns)) {
                fs.readFile(file, (err, text) => {
                    if (err) {
                        grunt.fail.fatal(err);
                        return callback(err);
                    }

                    let ast = helpers.parseModule(text.toString());

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

                        parseOpts(opts, application, getReplaceOpts(root, application), applicationRoot, callback, inclReplace);
                    } else {
                        callback();
                    }
                });
            } else {
                callback();
            }
        }, function (err) {
            if (err) {
                grunt.fail.fatal(err);
            }

            try {
                contents.htmlNames = htmlNames;
                let sorted = helpers.sortObject(contents);

                grunt.file.write(path.join(resourcesRoot, 'contents.json'), JSON.stringify(sorted, null, 2));
                grunt.file.write(path.join(resourcesRoot, 'contents.js'), 'contents=' + JSON.stringify(sorted));
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

        helpers.recurse(applicationRoot, function (file, callback) {
            if (helpers.validateFile(path.relative(applicationRoot, file), patterns)) {
                fs.readFile(file, (err, text) => {
                    if (err) {
                        grunt.fail.fatal(err);
                        return callback(err);
                    }

                    text = replaceIncludes(text.toString(), getReplaceOpts(root, application));
                    fs.unlink(file, () => {
                    });
                    helpers.writeFile(file.replace('.deprecated', ''), text, callback);
                });
            } else {
                callback();
            }
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

        helpers.recurse(applicationRoot, function (file, callback) {
            if (helpers.validateFile(path.relative(applicationRoot, file), patterns)) {
                const parts = file.split('#');
                const basename = path.basename(parts[1] || parts[0], '.deprecated');

                fs.readFile(file, (err, text) => {
                    if (err) {
                        grunt.fail.fatal(err);
                        return callback(err);
                    }

                    text = replaceIncludes(text.toString(), getReplaceOpts(root, application));
                    fs.unlink(file, () => {});
                    helpers.writeFile(path.join(applicationRoot, basename), text, callback);
                });
            } else {
                callback();
            }
        }, function (err) {
            if (err) {
                grunt.fail.fatal(err);
            }

            console.log(`Duration: ${(Date.now() - start) / 1000} sec`);
            done();
        });
    });
};