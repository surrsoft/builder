'use strict';

const fs             = require('fs');
const path           = require('path');
const through2       = require('through2');
const gutil          = require('gulp-util');
const PluginError    = gutil.PluginError;
const argv           = require('yargs').argv;
const minimatch      = require('minimatch');
const applySourceMap = require('vinyl-sourcemaps-apply');


var conditionalComments = /<!--(\[[\s\S]*?\])-->/gi,
    conditionalCommentsReplacements = /<!-#\/CC#(\d+)#->/gi,
    wsExpertComments = /<!--WS-EXPERT([\s\S]+?)WS-EXPERT-->/g,
    wsExpertCommentsReplacements = /<!-#\/WEC#(\d+)#->/gi,
    htmlComments = /<!--(?:[^\[\/][\s\S]*?)?-->/gi,

    possibleComments = /\/\/.*[\r\n]*/g,
    mnComments = /\s?\/\*[\s\S]*?\*+\/+?\s?/g,
    compressSymbols = / {|{ | }|} | =|= | ;|; |, | ,| \)|\) |\( | \(/g;

module.exports = opts => {

    return through2.obj(
        function (file, enc, cb) {
            if (file.isStream()) return cb(new PluginError('gulp-sbis-tmpl-min', 'Streaming not supported'));
            if (!['.tmpl', '.html', '.xhtml'].some(ext => ext == path.extname(file.path))) return cb(null, file);
            if (!['**/*.xhtml', '**/*.html', '!**/node_modules/**/*.html', '!**/service/**/*.html'].every(glob => minimatch(file.path, glob))) {
                return cb(null, file);
            }
            if (file.sourceMap) opts.sourcemap = true;

            if (['.html', '.xhtml'].some(ext => ext == path.extname(file.path))) {
                file.contents = Buffer.from(minifyFile(file.contents + ''));
            } else if (/\.original\.tmpl$/i.test(file.path)) {
                file.contents = Buffer.from(xmlMin(file.contents + ''));
            }

            cb(null, file);
        }
    );
};

function xmlMin (text) {
    var str = text.replace(/<![ \r\n\t]*(--([^\-]|[\r\n]|-[^\-])*--[ \r\n\t]*)>/g,"");
    return  str.replace(/>\s{0}</g,"><");
}

function minifyFile (data) {
    var ccStore = [], weStore = [];
    // WS-EXPERT не трогаем, там все живет своей жизнью
    data = removeWsExpertComments(data, weStore);
    // Условные комментарии тоже оставим, там тоже своя жизнь
    data = removeConditionalComments(data, ccStore);
    // Почистим комментарии
    data = data.replace(htmlComments, '');

    var scriptWord = '<script',
        endScriptWord = '</script>',
        startScr = data.indexOf(scriptWord),
        endScr,
        out = '';

    while (startScr != -1) {
        out += minifyDOM(data.substr(0, startScr));
        data = data.substr(startScr, data.length);
        // Найдем теперь первый > - это закрыли тег script
        endScr = data.indexOf('>');
        out += data.substr(0, endScr);
        data = data.substr(endScr, data.length);

        // Найдем теперь закрвыющий тег script
        endScr = data.indexOf(endScriptWord);

        // Минифицируем скрипт
        out += minifyScript(data.substr(0, endScr));

        // Пошли дальше
        data = data.substr(endScr, data.length);
        startScr = data.indexOf(scriptWord);
    }
    out += minifyDOM(data.substr(0, data.length));

    out = restoreConditionalComments(out, ccStore);
    out = restoreWsExpertComments(out, weStore);
    return out;
}

function minifyScript (data) {
    var slashes = saveSlashes(data);

    /**
     * Найдет все вхождения двойных слешей и сравнит с сохраненным массивом
     * Если найденное вхождение совпадет с одним из сохраненных, то пропустим его.
     * Остальные вхождения примем за комментарий и удалим. Так же удалим многострочные комментарии и переводы строк
     */
    data = data.replace(possibleComments, function (str) {
        var isNotComment;
        slashes.forEach(function (item) {
            if (str.indexOf(item) != -1) {
                isNotComment = true;
            }
        });
        if (isNotComment) {
            return str;
        } else {
            return '';
        }
    });
    data = data.replace(mnComments, '');
    data = data.replace(/\s{2,}/g, ' ');
    data = data.replace(compressSymbols, function (str) {
        str = str.replace(/ /, '');
        return str;
    });
    return data;
}

function restoreWsExpertComments(markup, store) {
    return markup.replace(wsExpertCommentsReplacements, function (str, commentID) {
        return '<!--WS-EXPERT' + store[+commentID] + 'WS-EXPERT-->';
    });
}

function minifyDOM(data) {
    data = data.replace(/[\n\r]\s*/g, ' ');
    data = data.replace(/>\s+</g, '> <');
    return data;
}

function saveSlashes(data) {
    //Пройдет по скрипту и сохранит все вхождения двойных слешей, заключенных в кавычки
    var correctDoubleSlashes = /".*(\/{2}.*?".*?[\r\n]*)/g,
        correctSlashes = /'.*(\/{2}.*?'.*?[\r\n]*)/g,
        savedSlahes = [];

    data.replace(correctDoubleSlashes, function (str, p1) {
        savedSlahes.push(p1);
        return str;
    });

    data.replace(correctSlashes, function (str, p1) {
        savedSlahes.push(p1);
        return str;
    });

    return savedSlahes;
}



/**
 * Удалить условный комментарий
 * @param {String} markup - разметка
 * @param {Array} store - хранилище для комментариев
 * @returns {String}
 */
function removeConditionalComments(markup, store) {
    return markup.replace(conditionalComments, function (str, commentContent) {
        store.push(commentContent);
        return '<!-#/CC#' + (store.length - 1) + '#->';
    });
}

/**
 * Восстановить условынй комментарий
 * @param {String} markup - разметка
 * @param {Array} store - хранилище для комментариев
 * @returns {String}
 */
function restoreConditionalComments(markup, store) {
    return markup.replace(conditionalCommentsReplacements, function (str, commentID) {
        return '<!--' + store[+commentID] + '-->';
    });
}

/**
 * Удалить WS-EXPERT комментарий
 * @param {String} markup - разметка
 * @param {Array} store - хранилище для комментариев
 * @returns {String}
 */
function removeWsExpertComments(markup, store) {
    return markup.replace(wsExpertComments, function (str, commentContent) {
        store.push(commentContent);
        return '<!-#/WEC#' + (store.length - 1) + '#->';
    });
}