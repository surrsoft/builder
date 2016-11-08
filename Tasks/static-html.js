'use strict';

var path = require('path');
var fs = require('fs');
var esprima = require('esprima');
var traverse = require('estraverse').traverse;
var transliterate = require('./../lib/utils/transliterate');
var replaceIncludes = require('./../lib/utils/include-replacer');

var cache = {};

function parseModule(module) {
    var res;
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
    var obj = {};
    properties.forEach(function (prop) {
        obj[prop.key.name] = prop.value.value;
    });
    return obj;
}

module.exports = function (grunt) {
    var srvPath = grunt.option('services_path') || '';
    var userParams = grunt.option('user_params') || false;
    var globalParams = grunt.option('global_params') || false;
    var htmlNames = {};
    srvPath = srvPath.replace(/"/g, '');

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

    function generateHTML(htmlTemplate, outFileName, replaceOpts, applicationRoot) {
        var templatePath = '';
        if (!htmlTemplate) {
            templatePath = path.join(__dirname, './../resources/index.html');
            console.log(templatePath);
        } else {
            templatePath = path.join(applicationRoot, 'resources', htmlTemplate);
        }

        var text = cache[templatePath] || (cache[templatePath] = grunt.file.read(templatePath));
        text = replaceIncludes(text, replaceOpts);
        grunt.file.write(path.join(applicationRoot, outFileName), text);
    }

    function parseOpts(opts, application, replaceOpts, applicationRoot) {
        var
            moduleName = opts.moduleName,
            webPage = opts.webPage || {},
            htmlTemplate = webPage.htmlTemplate || '',
            outFileName = webPage.outFileName;
        replaceOpts.WINDOW_TITLE = opts.title || '';
        replaceOpts.START_DIALOG = moduleName || '';

        if (!outFileName) {
            return;
        } else if (!htmlTemplate) {
            grunt.log.warn('Using default template for otput file', outFileName + '.html');
        } else if (!(htmlTemplate.indexOf('Тема Скрепка') > -1 || htmlTemplate.indexOf('Tema_Skrepka') > -1)) {
            grunt.log.warn('HTML Template is not from Tema_Skrepka(Тема Cкрепка)', htmlTemplate);
        }

        htmlNames[moduleName] = application.replace('/', '') + outFileName + '.html';

        htmlTemplate = transliterate(htmlTemplate.replace(/\\/g, '/'));

        generateHTML(htmlTemplate, outFileName + '.html', replaceOpts, applicationRoot);
    }

    grunt.registerMultiTask('static-html', 'Generate static html from modules', function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача static-html.');
        var start = Date.now();
        var root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application),
            resourcesRoot = path.join(applicationRoot, 'resources'),
            sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src),
            oldHtml = grunt.file.expand({cwd: applicationRoot}, this.data.html),
            replaceOpts = getReplaceOpts(root, application);

        try {
            var contents = grunt.file.readJSON(path.join(resourcesRoot, 'contents.json'));
            htmlNames = contents.htmlNames || {};
        } catch (err) {
            grunt.log.warn('Error while requiring contents.json', err);
        }

        var errPath = '';

        if (oldHtml && oldHtml.length) {
            oldHtml.forEach(function (file) {
                var filePath = path.join(applicationRoot, file);
                try {
                    fs.unlinkSync(path.join(applicationRoot, file));
                } catch (err) {
                    console.log('Can\'t delete old html: ', filePath, err);
                }
            });
        }

        try {
            sourceFiles.forEach(function (file) {
                errPath = file;
                var text = grunt.file.read(path.join(applicationRoot, file));
                var ast = parseModule(text);

                if (ast instanceof Error) {
                    ast.message += '\nPath: ' + errPath;
                    return grunt.fail.fatal(ast);
                }

                var arrExpr = [];
                var ReturnStatement = null;
                var moduleName = '';

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

                            var fnNode = null;
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
                    var opts = {};
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

                    parseOpts(opts, application, replaceOpts, applicationRoot)
                }
                errPath = '';
            });

            try {
                contents.htmlNames = htmlNames;

                grunt.file.write(path.join(resourcesRoot, 'contents.json'), JSON.stringify(contents, null, 2));
                grunt.file.write(path.join(resourcesRoot, 'contents.js'), 'contents=' + JSON.stringify(contents));
            } catch (err) {
                grunt.fail.fatal(err);
            }

            console.log('Duration: ' + (Date.now() - start));
        } catch (err) {
            grunt.fail.fatal(err, errPath);
        }
    });

    grunt.registerMultiTask('xml-deprecated', 'Convert deprecated xml', function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача xml-deprecated.');
        var start = Date.now();
        var root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application),
            resourcesRoot = path.join(applicationRoot, 'resources'),
            sourceFiles = grunt.file.expand({cwd: resourcesRoot}, this.data.src),
            replaceOpts = getReplaceOpts(root, application);

        var errPath = '';

        try {
            sourceFiles.forEach(function (file) {
                errPath = file;
                var text = grunt.file.read(path.join(resourcesRoot, file));
                text = replaceIncludes(text, replaceOpts);

                try {
                    fs.unlinkSync(path.join(applicationRoot, file));
                } catch (err) {
                    //ignore
                }

                grunt.file.write(path.join(resourcesRoot, transliterate(file.replace('.deprecated', ''))), text);
                errPath = '';
            });

            console.log('Duration: ' + (Date.now() - start));
        } catch (err) {
            grunt.fail.fatal(err, errPath);
        }
    });

    grunt.registerMultiTask('html-deprecated', 'Convert deprecated html', function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача html-deprecated.');
        var start = Date.now();
        var root = this.data.root,
            application = this.data.application,
            applicationRoot = path.join(root, application),
            resourcesRoot = path.join(applicationRoot, 'resources'),
            sourceFiles = grunt.file.expand({cwd: resourcesRoot}, this.data.src),
            replaceOpts = getReplaceOpts(root, application);

        var errPath = '';

        try {
            sourceFiles.forEach(function (file) {
                errPath = file;
                var parts = file.split('#');
                var basename = path.basename(parts[1] || parts[0], '.deprecated');
                var text = grunt.file.read(path.join(resourcesRoot, file));
                text = replaceIncludes(text, replaceOpts);

                try {
                    fs.unlinkSync(path.join(resourcesRoot, file));
                } catch (err) {
                    //ignore
                }

                grunt.file.write(path.join(applicationRoot, transliterate(basename)), text);
                errPath = '';
            });

            console.log('Duration: ' + (Date.now() - start));
        } catch (err) {
            grunt.fail.fatal(err, errPath);
        }
    });
};