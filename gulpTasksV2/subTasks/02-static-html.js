'use strict';

const path              = require('path');
const gutil             = require('gulp-util');
const argv              = require('yargs').argv;
// const translit          = require('../../lib/utils/transliterate');
// const replaceIncludes   = require('../../lib/utils/include-replacer');

let files = [];

exports.traverse = opts => {
    if (!opts.node || !opts.contents) return;

    let node  = opts.node;

    if (findExpression(node, 'webPage') && node.expression.right && node.expression.right.type == 'ObjectExpression') {
        opts.data.arrExpr.push(node.expression);
    }

    if (findExpression(node, 'title') && node.expression.right && node.expression.right.type == 'Literal') {
        opts.data.arrExpr.push(node.expression);
    }

    if (node.type == 'CallExpression' && node.callee.type == 'Identifier' && node.callee.name == 'define') {
        if (node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
            opts.data.moduleName = node.arguments[0].value;
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
                        opts.data.ReturnStatement = i.argument;
                    }
                });
            }
        }
    }
};

exports.execute = opts => {
    opts.data.arrExpr.forEach(function (expr) {
        try {
            expr.left.object.name == opts.data.ReturnStatement.name ? opts[expr.left.property.name] =
                expr.right.type == 'ObjectExpression' ? parseObjectExpression(expr.right.properties)
                    : expr.right.value : false;
        } catch (err) {
            gutil.log(err);
        }
    });

    parseOpts(opts, argv.application, getReplaceOpts(argv.root, argv.application)/*, path.join(argv.root, argv.application)*/);

    return files;
};

exports.xmlDeprecated = opts => {
    let text = replaceIncludes(opts.file.contents.toString('utf8'), getReplaceOpts(argv.root, argv.application), opts.acc);
    opts.file.contents = Buffer.from(text);
    opts.file.path = opts.file.path.replace('.deprecated', '');
};

exports.htmlDeprecated = opts => {
    const parts     = opts.file.path.split('#');
    const basename  = path.basename(parts[1] || parts[0], '.deprecated');

    let text = replaceIncludes(opts.file.contents.toString('utf8'), getReplaceOpts(argv.root, argv.application), opts.acc);
    // helpers.writeFile(path.join(applicationRoot, basename), text, callback);
};

function parseOpts (opts, application, replaceOpts/*, applicationRoot*/) {
    let moduleName      = opts.moduleName;
    let webPage         = opts.webPage || {};
    let htmlTemplate    = webPage.htmlTemplate || '';
    let outFileName     = webPage.outFileName;

    replaceOpts.WINDOW_TITLE = opts.title || '';
    replaceOpts.START_DIALOG = moduleName || '';

    if (!outFileName) return;
    if (!htmlTemplate) gutil.log(`Using default template for output file ${outFileName}.html`);

    opts.acc.addContentsHtmlNames(moduleName, application.replace('/', '') + outFileName + '.html');

    generateHTML(htmlTemplate, outFileName + '.html', replaceOpts, /*applicationRoot, */opts/*, cb*/);
}

function generateHTML (htmlTemplate, outFileName, replaceOpts, /*applicationRoot, */opts) { // opts.acc
    let templatePath = '';

    if (!htmlTemplate) {
        templatePath = path.join(__dirname, '../../resources/index.html'); // FIXME !!!!!: проверить в грунте __dirname
        opts.acc.add(templatePath);
    } else {
        // templatePath = path.join(opts.file.base, htmlTemplate);
        templatePath = opts.acc.loadFileByRelative(htmlTemplate);
    }
    let text;
    if (opts.acc.containsPath(templatePath)) {
        let file = opts.acc.getFile(templatePath);
        text = replaceIncludes(file.contents, replaceOpts, opts.acc);
        files.push({
            base: path.join(argv.root, argv.application),
            path: path.join(argv.root, argv.application, outFileName),
            contents: text
        });
    } else {
        // FIXME: можно съэкономить на спичках и ждать файлы, а не грузить сразу
        opts.acc.loadFile(templatePath);
        let file = opts.acc.getFile(templatePath);
        text = replaceIncludes(file.contents, replaceOpts, opts.acc);
        files.push({
            base: path.join(argv.root, argv.application),
            path: path.join(argv.root, argv.application, outFileName),
            contents: text
        });
    }
}

function getReplaceOpts (root, application) {
    const srvPath       = (argv.services_path || '').replace(/"|'/g, '');
    const userParams    = argv.user_params || false;
    const globalParams  = argv.global_params || false;

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

function findExpression (node, left) {
    return node.type == 'ExpressionStatement' && node.expression.type == 'AssignmentExpression' &&
        node.expression.operator == '=' && node.expression.left.type == 'MemberExpression' &&
        node.expression.left.property.name == left && node.expression.left.object &&
        node.expression.left.object.type == 'Identifier';
}

function parseObjectExpression (properties) {
    let obj = {};
    for (let i = 0, l = properties.length; i < l; i++) obj[properties[i].key.name] = properties[i].value.value;
    return obj;
}

const INCLUDE           = /%\{INCLUDE\s(?:"|')([^'"]*)(?:"|')\s?}/g;
const WINDOW_TITLE      = /%\{WINDOW_TITLE}/g;
const APPEND_STYLE      = /%\{APPEND_STYLE}/g;
const APPEND_JAVASCRIPT = /%\{APPEND_JAVASCRIPT}/g;
const ACCESS_LIST       = /%\{ACCESS_LIST}/g;
const APPLICATION_ROOT  = /%\{APPLICATION_ROOT}/g;
const SBIS_ROOT         = /%\{WI\.SBIS_ROOT}/g;
const RESOURCE_ROOT     = /%\{RESOURCE_ROOT}/g;
const SERVICES_PATH     = /%\{SERVICES_PATH}/g;
const USER_PARAMS       = /%\{CONFIG\.USER_PARAMS}/g;
const GLOBAL_PARAMS     = /%\{CONFIG\.GLOBAL_PARAMS}/g;
const SAVE_LAST_STATE   = /%\{SAVE_LAST_STATE}/g;
const START_DIALOG      = /%\{START_DIALOG(.*)}/g;

function replaceIncludes (text, opts, acc) {
    let modules = acc.modules;

    while (INCLUDE.test(text)) {
        text = text.replace(INCLUDE, function (m, include) {
            let result = '';
            for (let i = 0, l = modules.length; i < l; i ++) {
                if (acc.hasPath(path.join(modules[i], '../', include))) {
                    let filePath = path.join(modules[i], '../', include);
                    if (!acc.containsPath(filePath)) acc.loadFile(filePath);
                    result = acc.getFile(filePath).contents;
                }
            }

            return result;
        });
    }

    text = text.replace(WINDOW_TITLE, opts.WINDOW_TITLE);
    text = text.replace(APPEND_STYLE, opts.APPEND_STYLE);
    text = text.replace(APPEND_JAVASCRIPT, opts.APPEND_JAVASCRIPT);
    text = text.replace(ACCESS_LIST, opts.ACCESS_LIST);
    text = text.replace(APPLICATION_ROOT, opts.APPLICATION_ROOT);
    text = text.replace(SBIS_ROOT, opts.SBIS_ROOT);
    text = text.replace(RESOURCE_ROOT, opts.RESOURCE_ROOT);
    text = text.replace(SERVICES_PATH, opts.SERVICES_PATH);
    text = text.replace(USER_PARAMS, opts.USER_PARAMS);
    text = text.replace(GLOBAL_PARAMS, opts.GLOBAL_PARAMS);
    text = text.replace(SAVE_LAST_STATE, opts.SAVE_LAST_STATE);
    text = text.replace(START_DIALOG, opts.START_DIALOG);

    return text;
}