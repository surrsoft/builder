/**
 * Created by ShilovDA on 11.10.13.
 */

"use strict";
var path = require('path');
var xhtmlParser = global.requirejs ? global.requirejs('Core/markup/ParserUtilities'): undefined;
var Deferred = global.requirejs ? global.requirejs('Core/Deferred') : undefined;
var ParallelDeferred = global.requirejs ? global.requirejs('Core/ParallelDeferred') : undefined;
var genJsDoc = require('./../jsDoc/generateJsDoc');
var tmplLocalizator = require('./tmplLocalizator');
var fs = require('fs');
const nlog  = require('../logger-native');
const glob  = require('glob');
const argv  = require('yargs').argv;


var configModule = global.requirejs ? global.requirejs('Core/tmpl/config') : undefined;


var
    wsExpertComments = /<!--WS-EXPERT([\s\S]+?)WS-EXPERT-->/g,
    translate = /\{\[([\s\S]+?)]}/g,
    r = new RegExp('rk *\\( *(["\'][\\S\\s]*?["\']) *\\)', 'g'),
    rWComSingle = new RegExp('[\']([\\S\\s]*?)[\'](?:,[ ]*["\']([\\S\\s]*?)[\'"])?'),
    rWComDouble = new RegExp('["]([\\S\\s]*?)["](?:,[ ]*["\']([\\S\\s]*?)[\'"])?'),
    isDoT2 = /{{[\S\s]*|[\S\s]*}}/,
    isComment = /^<!--?[\s\S]*?-?->$/,
    isDirective = /%{\w+ [\s\S]+}/,
    isDoctype = /!DOCTYPE/,
    isAMD = /define[\S\s]*?\([\S\s]*?["']js!([A-Za-z0-9\.]+)["']/,
    isArray = /Array|array/,
    isContent = /Content|content/;

(function () {
    var
        optTags = ['option', 'opt', 'options', 'opts'],
        components = {},
        componentsProperties = {},
        words = [],
        jsonOutput,
        grunt,
        cwd,
        i18nCacheContent;

    var progress = {
        count: 0,
        log: function (curCount, moduleName) {
            var percent = Math.floor(curCount * 100 / this.count),
                name = path.normalize(moduleName).split(path.sep).pop();
            console.log('[' + percent + '%]UI ' + name);
        }
    };

    /**
     * Вычитывает файл со свойствами контрола
     * @param {String} modName - название контрола
     */
    function readPropertiesJSON(modName) {
        var properties = {};
        var modPath = path.join(jsonOutput, modName + '.json');

        if (fs.existsSync(modPath)) {
            try {
                properties = JSON.parse(fs.readFileSync(modPath));
            } catch (e) {
                if (grunt) {
                    grunt.log.warn('Can\'t read ' + modPath);
                } else {
                    nlog.warn('Can\'t read ' + modPath);
                }
            }
        }
        componentsProperties[modName] = properties;
    }

    /**
     *
     * @param pathToSource
     * @param text
     */
    function readWordsInModule(pathToSource, text) {
        var
            matches, matchesWords;

        // Поищем за одно и слова для перевода
        while (matches = r.exec(text)) {
            if (matches[1]) {
                var rW = matches[1][0] == '\'' ? rWComSingle : matches[1][0] =='"' ? rWComDouble : rWComSingle;
                matchesWords = rW.exec(matches[1]);
                if (matchesWords) {
                    pushKey(matchesWords[1], matchesWords[2] ? matchesWords[2] : '', pathToSource);
                }
            }
        }
    }

    /**
     *
     * @param key
     * @param ctx
     * @param module
     * @param ignoreCache
     */
    function pushKey(key, ctx, module, ignoreCache) {
        var tempCtx = ctx.trim();

        if (!key || isComment.test(key) || isDirective.test(key) || isDoctype.test(key)) {
            return;
        }

        if (isDoT2.test(key)) {
            key.replace(translate, function (match, p1) {
                if (p1.indexOf('@@') > -1) {
                    // Значит в ключе содержится контекст
                    tempCtx = p1.substring(0, p1.indexOf('@@'));
                    p1 = p1.substr(p1.indexOf('@@') + 2);
                }

                words.push({
                    key: p1,
                    context: tempCtx,
                    module: module,
                    ui: cwd
                });

                return p1;
            });
        } else {
            key = key.replace(translate, '$1');

            if (key.indexOf('@@') > -1) {
                // Значит в ключе содержится контекст
                tempCtx = key.substring(0, key.indexOf('@@'));
                key = key.substr(key.indexOf('@@') + 2);
            }

            if (!ignoreCache) {
                addToCache(module, key, tempCtx);
            }

            words.push({
                key: key,
                context: tempCtx,
                module: module,
                ui: cwd
            });
        }

    }

    /**
     * Ищет все компоненты и их свойства в папке --root + --application
     * @param cwd
     */
    function findComponentsAndProperties(cwd) {
        var sourceFiles,
            text, modName;
        if (grunt) {
            sourceFiles = grunt.file.expand({cwd}, ['**/*.module.js']);
        } else {
            sourceFiles = glob.sync('**/*.module.js', {cwd});
        }

        sourceFiles.forEach(function (pathToSource) {
            // Вычитаем файл с модулем, и найдем в нем название модуля
            pathToSource = path.join(cwd, pathToSource);
            if (!checkCache(pathToSource)) {
                text = fs.readFileSync(pathToSource).toString();
                if (text) {
                    modName = (modName = text.match(isAMD)) ? modName[1] : false;
                    if (modName && !components[modName]) {
                        components[modName] = pathToSource;
                        // Здесь же получим свойства компонента
                        readPropertiesJSON(modName);
                        readWordsInModule(pathToSource, text);
                    }
                }
            }
        });
    }

    /**
     *
     * @param cwd
     */
    function findWordsInXHTML(cwd) {
        var sourceFiles,
            absPath, text;
        if (grunt) {
            sourceFiles = grunt.file.expand({cwd}, ['**/*.xhtml', '**/*.tmpl']);
        } else {
            sourceFiles = glob.sync('**/*.xhtml', {cwd}).concat(glob.sync('**/*.tmpl', {cwd}));
        }


        sourceFiles.forEach(function (pathToSource) {
            absPath = path.join(cwd, pathToSource);
            if (!checkCache(absPath)) {
                text = fs.readFileSync(absPath);
                if (text && text.replace(/\s/g, '')) {
                    findWordsInWsExpert(text, absPath);
                    findWordsInDOM(text, absPath);
                }
            }
        });
    }

    function findWordsInWsExpert(text, absPath) {
        var posCtx = -1;
        text.replace(wsExpertComments, function (str, commentContent) {
            commentContent.replace(translate, function (str, key) {
                posCtx = key.indexOf('@@');
                if (posCtx > -1) {
                    pushKey(key.substr(0, posCtx), key.substr(posCtx + 2), absPath);
                } else {
                    pushKey(key, '', absPath);
                }
                return str;
            });
            return str;
        });
    }

    /**
     * Проходит по DOM дереву и набирает простые текстовые ноды и компоненты
     * @param {String} text - текст из xhtml файла
     * @param currentPath
     */
    function findWordsInDOM(text, currentPath) {
        var dom;
        try {
            console.log(`createResultDictionary::findWordsInDOM::currentPath -> ${currentPath}`);

            if (/\.tmpl$/.test(currentPath)) {
                var res = tmplLocalizator.parseTmpl(grunt, text, currentPath);
                words.push(res);
            } else {
                if (xhtmlParser) {
                    dom = xhtmlParser.parse(text);
                } else {
                    xhtmlParser = global.requirejs('Core/markup/ParserUtilities');
                    dom = xhtmlParser.parse(text);
                }

                enumChildNodes(dom, currentPath);
            }
        } catch (e) {
            if (grunt) {
                grunt.log.warn('Can\'t parse DOM ' + e);
            } else {
                nlog.warn('Can\'t parse DOM ' + e);
            }

        }
    }

    /**
     * Перебрать все дочерние узлы
     * @param node
     * @param absPath
     * @param considerTheCurrentNode
     */
    function enumChildNodes(node, absPath, considerTheCurrentNode) {
        function currentNode(node, absPath) {
            if (node.nodeType == 1 && node.nodeName.toLocaleLowerCase() !== 'script' && node.nodeName.toLocaleLowerCase() !== 'style') {
                if (node.hasAttribute('title')) {
                    pushKey(node.getAttribute('title'), '', absPath);
                }

                if (node.nodeName !== 'component') {
                    enumChildNodes(node, absPath);
                } else {
                    findWordsInComponent(node, absPath);
                }
            } else if (node.nodeType == 3) {
                if (node.nodeValue && /\S/.test(node.nodeValue) && optTags.indexOf(node.parentNode.nodeName) === -1) {
                    pushKey(node.nodeValue.trim(), '', absPath);
                }
            }
        }

        if (considerTheCurrentNode) {
            currentNode(node, absPath);
        }

        if (node.nodeType == 1 || node.nodeType == 9) {
            var child = node.firstChild;
            while (child) {
                currentNode(child, absPath);
                child = child.nextSibling;
            }
        }
    }

    /**
     * Перебирает компонент, ищет переводные свойства в аттрибуте config и набирает теги
     * @param node - элемент компонента
     * @param absPath
     */
    function findWordsInComponent(node, absPath) {
        // Для компонента надо вытащить его имя, и найти файл со свойствами
        var
            moduleName = node.getAttribute('data-component'),
            properties = componentsProperties[moduleName],
            transProp = [];

        if (properties && Object.keys(properties).length && properties.properties && properties.properties["ws-config"]) {
            propertiesParser(transProp, properties.properties["ws-config"].options, "", moduleName);
        }

        // Нужно пройтись по детям компонента
        try {
            // Сначала пройдем в глубь и найдем только компоненты
            var child = node.firstChild;
            while (child) {
                if (child.nodeType === 1 && child.nodeName == 'component') {
                    findWordsInComponent(child, absPath);
                }
                child = child.nextSibling;
            }

            // Теперь займемся опциями
            enumComponentChildNodes(transProp, node, '/', absPath);
        } catch (e) {
            if (grunt) {
                grunt.log.error(e);
            } else {
                nlog.error(e);
            }
        }
    }

    /**
     * Рекурсивно проходит по свойствам компонента и находит все перводные свойства
     * Записывает их в массив transPropXPath
     * @param transPropXPath - массив с путями до переводных свойств
     * @param object - входящий объект
     * @param propPath - текущий путь до объекта
     * @param moduleName
     */
    function propertiesParser(transPropXPath, object, propPath, moduleName) {
        if (!object) {
            return;
        }

        Object.keys(object).forEach(function (key) {
            var
                elem = object[key],
                isCompType = isArray.test(elem.type) ? '@' : isContent.test(elem.type) ? '$' : '';

            if (elem.options) {
                propertiesParser(transPropXPath, elem.options, propPath + '/' + isCompType + key, moduleName);
            } else if (elem.itemType || components[elem.type]) {
                var properties = componentsProperties[elem.itemType || elem.type];
                if (!properties && elem.itemType) {
                    var modName = elem.itemType;

                    // костыль не трогать
                    if (moduleName === 'SBIS3.CORE.TabControl' && modName === 'TabItem') {
                        readPropertiesJSON('SBIS3.CORE.TabControl/TabItem');
                        properties = componentsProperties['SBIS3.CORE.TabControl/TabItem'] || {};
                    } else {
                        readPropertiesJSON(modName);
                        properties = componentsProperties[modName] || {};
                    }
                }

                if (properties && Object.keys(properties).length && properties.properties && properties.properties["ws-config"]) {
                    propertiesParser(transPropXPath, properties.properties["ws-config"].options, propPath + '/' + isCompType + key, moduleName);
                }
            } else if (elem.translatable || isCompType === '$') {
                transPropXPath.push(propPath + '/' + isCompType + key);
            }
        });
    }

    /**
     * Перебирает все теги option и options
     * @param transProp
     * @param node
     * @param xPath
     * @param absPath
     */
    function enumComponentChildNodes(transProp, node, xPath, absPath) {
        var child = node.firstChild,
            i, len;

        while (child) {
            // Только теги опций
            if (child.nodeType != 1 || optTags.indexOf(child.nodeName) == -1) {
                // Делаем допущение для обычных html тегов, их тоже подготавливаем
                enumChildNodes(child, absPath, true);
                child = child.nextSibling;
                continue;
            }

            var nodeName = child.nodeName,
                name = child.hasAttribute('name') ? child.getAttribute('name') : '',
                value = child.hasAttribute('value') ? child.getAttribute('value') : '',
                type = child.hasAttribute('type') ? child.getAttribute('type') : '';

            // Здесь либо option, либо options, либо components, остальное игнорим
            if (nodeName == 'option' || nodeName == 'opt') {
                // Переберем массив transProp и поищем эту опцию
                for (i = 0, len = transProp.length; i < len; ++i) {
                    if (transProp[i] === xPath + name) {
                        if (value) {
                            pushKey(value.trim(), '', absPath);
                        } else {
                            pushKey(child.innerHTML().trim(), '', absPath);
                        }
                        break;
                    } else if (transProp[i] === xPath + '$' + name) {
                        // Если опция контент и переводится
                        if (value) {
                            findWordsInDOM(value, absPath);
                        } else {
                            enumChildNodes(child, absPath);
                        }
                        break;
                    }
                }
            } else if (nodeName == 'options' || nodeName == 'opts') {
                if (isArray.test(type)) {
                    var pp = xPath + '@' + name,
                        isSimple;

                    // Надо понять, массив может хранить сложные типы или нет
                    for (i = 0, len = transProp.length; i < len; ++i) {
                        if (transProp[i] === pp) {
                            isSimple = true;
                            break;
                        } else if (transProp[i].indexOf(pp) != -1) {
                            isSimple = false;
                            break;
                        }
                    }

                    if (isSimple !== undefined) {
                        var childNodes = child.childNodes;
                        for (i = 0, len = childNodes.length; i < len; i++) {
                            var childNode = childNodes[i],
                                childNodeName = childNode.nodeName;
                            if (childNode.nodeType == 1) {
                                if (isSimple === true && (childNodeName == 'option' || childNodeName == 'opt')) {
                                    if (childNode.hasAttribute('value')) {
                                        pushKey(childNode.getAttribute('value').trim(), '', absPath);
                                    } else {
                                        pushKey(childNode.innerHTML().trim(), '', absPath);
                                    }
                                } else if (isSimple === false && (childNodeName == 'options' || childNodeName == 'opts')) {
                                    enumComponentChildNodes(transProp, childNode, pp + '/', absPath);
                                }
                            }
                        }
                    }
                } else {
                    enumComponentChildNodes(transProp, child, xPath + child.getAttribute('name') + '/', absPath);
                }
            }
            child = child.nextSibling;
        }
    }

    /**
     * Ищет в конфигурации переводные свойства
     * @param {Object} object - входящий объект
     * @param {Array} xPath - путь до свойства
     * @param absPath
     */
    function findWordsInCfg(object, xPath, absPath) {
        var firstSymbol = xPath[0][0],
            option = (firstSymbol === '@' || firstSymbol === '$') ? xPath[0].slice(1) : xPath[0],
            val = object[option],
            i, len;

        if (!val) {
            return;
        }

        if (firstSymbol == '@' && Array.isArray(val)) {
            //Свойство будет массивом
            for (i = 0, len = val.length; i < len; i++) {
                if (xPath.length === 1) {
                    pushKey(val[i].trim(), '', absPath);
                } else {
                    findWordsInCfg(val[i], xPath.slice(1), absPath);
                }
            }
        } else if (firstSymbol == '$') {
            // Это html, его надо распарсить как дом
            val = findWordsInDOM(val, absPath);
            if (val) {
                object[option] = val;
            }
        } else if (xPath.length > 1) {
            // Свойство объект
            findWordsInCfg(val, xPath.slice(1), absPath);
        } else {
            // Обычное свойсвто
            pushKey(val.trim(), '', absPath);
        }
    }

    function checkCache(pathToSource) {
        var mtime,
            fromCache;

        try {
            mtime = new Date(fs.statSync(pathToSource).mtime);
        } catch (e) {
            if (grunt) {
                grunt.log.error(e);
            } else {
                nlog.error(e);
            }
            return;
        }

        if (pathToSource in i18nCacheContent && (+mtime === +new Date(i18nCacheContent[pathToSource].mtime))) {
            i18nCacheContent[pathToSource].words.filter(function (word) {
                if (Deferred) {
                    return !(word instanceof Deferred);
                } else {
                    return !(word instanceof global.requirejs('Core/Deferred'));
                }

            }).forEach(function (word) {
                pushKey(word.key, word.ctx, pathToSource, true);
            });

            fromCache = true;
        } else {
            delete i18nCacheContent[pathToSource];
        }

        return fromCache;
    }

    function addToCache(pathToSource, key, ctx) {
        if (!i18nCacheContent[pathToSource]) {
            i18nCacheContent[pathToSource] = {
                mtime: fs.statSync(pathToSource).mtime,
                words: [
                    {
                        key: key,
                        ctx: ctx
                    }
                ]
            };
        } else {
            i18nCacheContent[pathToSource].words.push({
                key: key,
                ctx: ctx
            })
        }
    }

    module.exports = {
        createResultDict: function (g, done) {
            if (undefined === g) { // сравниваю именно с undefined т.к. в случае с gulp я передаю null
                return;
            } else if (g) {
                grunt = g;
            }
            if (grunt) {
                grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается построение результирующего словаря.');
            } else {
                nlog.info('Запускается построение результирующего словаря.')
            }
            // Нужные еще опции --out и --modules
            var out, modules, cache, i18nCache;
            if (grunt) {
                out = grunt.option('out').replace(/"/g, ''),
                modules = grunt.option('modules').replace(/"/g, ''),
                cache = grunt.option('json-cache').replace(/"/g, ''),
                i18nCache = path.join(cache, 'i18n-cache.json');
            } else {
                out = argv.out.replace(/"/g, ''),
                modules = argv.modules.replace(/"/g, ''),
                cache = argv['json-cache'].replace(/"/g, ''),
                i18nCache = path.join(cache, 'i18n-cache.json');
            }

            if (!out) {
                if (grunt) {
                    return grunt.fail.fatal('Parameter "out" is not find');
                } else {
                    return done();
                }
            }

            if (!modules && grunt) {
                grunt.fail.fatal('Parameter "modules" is not find'); // на gulp-е тут валиться не надо т.к. в случае отсутствия опции modules, он свалится при запуске gulp-а
                return;
            }

            i18nCacheContent = fs.existsSync(i18nCache) ? fs.readFileSync(i18nCache) || '{}' : '{}';

            i18nCacheContent = JSON.parse(i18nCacheContent);

            // Считаем что builder лежит в jinnee в папке distrib\builder\ // TODO: пожалуйста, кто в курсе напишите здесь зачем так считать ?
            jsonOutput = cache || path.join(__dirname, '../../../../jsDoc-json-cache');

            genJsDoc(grunt, modules, jsonOutput, function (error) {
                if (error) {
                    if (grunt) {
                        grunt.log.error(error);
                    } else {
                        nlog.error(error);
                    }
                }

                var paths = modules.split(';'),
                    i, len;

                // Теперь в параметре modules может быть и путь до файла json
                if (paths.length == 1 && fs.lstatSync(modules).isFile()) {
                    try {
                        paths = JSON.parse(fs.readFileSync(modules));
                        if (!Array.isArray(paths)) {
                            if (grunt) {
                                grunt.log.error('Parameter "modules" incorrect');
                            } else {
                                nlog.error(error);
                            }
                            return;
                        }
                    } catch (e) {
                        if (grunt) {
                            grunt.log.error('Parameter "modules" incorrect. Can\'t read ' + modules);
                        } else {
                            nlog.error(error);
                        }
                        return;
                    }
                }

                // Выставим размер прогресс бара, два цикла будет
                progress.count = paths.length * 2;

                // Надо пройтись по всем путям, и найти компоненты
                for (i = 0, len = paths.length; i < len; i++) {
                    if (!paths[i]) continue;
                    cwd = paths[i];
                    try {
                        progress.log(i, paths[i]);
                        findComponentsAndProperties(paths[i]);
                    } catch (e) {
                        if (grunt) {
                            grunt.fail.fatal(e);
                        } else {
                            return done(e);
                        }
                    }
                }

                // Теперь еще раз проходимся по модулям и ищем xhtml файлы, когда уже есть все компоненты
                for (i = 0, len = paths.length; i < len; i++) {
                    if (!paths[i]) continue;
                    cwd = paths[i];
                    try {
                        progress.log(len + i, paths[i]);
                        findWordsInXHTML(paths[i]);
                    } catch (e) {
                        if (grunt) {
                            grunt.log.error(e);
                        } else {
                            nlog.error(e);
                        }
                    }
                }

                progress.log(paths.length * 2, 'Сбор слов завершен');

                var defs = words.filter(function (word) {
                    if (Deferred) {
                        return word instanceof Deferred;
                    } else {
                        return word instanceof global.requirejs('Core/Deferred');
                    }

                });
                var xhtmlWords = words.filter(function (word) {
                    if (Deferred) {
                        return !(word instanceof Deferred);
                    } else {
                        return word instanceof global.requirejs('Core/Deferred');
                    }

                });
                if (defs.length) {
                    Promise.all(defs.map(function(def) {
                        return new Promise(function(resolve) {
                            def.addCallback(function (res) {
                                resolve(res.words);
                            }).addErrback(function (err) {
                                console.error(err);
                                resolve();  
                            })
                        })
                    })).then(function (results) {
                        var resultWords = xhtmlWords || [];
                        results.forEach(function (result) {

                            result = result || [];
                            result.forEach(function (newWord) {
                                newWord.ui = cwd;
                            });
                            resultWords = resultWords.concat(result);
                        });
                        writeWords(resultWords);
                    }, function (err) {
                        console.error(err)
                    });
                } else {
                    writeWords(xhtmlWords);
                }

                function writeWords(words) {
                    // Записать в результирующий словарь
                    if (fs.lstatSync(path.dirname(out)).isDirectory()) {
                        if (grunt) {
                            grunt.file.write(out, JSON.stringify(words, null, 2));
                            grunt.file.write(i18nCache, JSON.stringify(i18nCacheContent, null, 2));
                        } else {
                            fs.writeFileSync(out, JSON.stringify(words, null, 2));
                            fs.writeFileSync(i18nCache, JSON.stringify(i18nCacheContent, null, 2));
                        }
                    } else {
                        if (grunt) {
                            grunt.fail.warn('Could\'t create output file ' + out);
                        } else {
                            return done('Could\'t create output file ' + out)
                        }
                    }

                    nlog.info('Построение результирующего словаря выполнено.');

                    done(error);
                }
            });
        }
    }
})();