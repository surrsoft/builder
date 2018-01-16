'use strict';

const path          = require('path');
const gutil         = require('gulp-util');
const estraverse    = require('estraverse');
const translit      = require('../../lib/utils/transliterate');

exports.traverse = opts => {
    let node = opts.node;
    let file = opts.file;

    if (node.type == 'AssignmentExpression' && node.operator == '=') {
        if (node.left.type == 'MemberExpression' && node.left.object && node.left.object.name == 'module' && node.left.property && node.left.property.name == 'exports') {
            parseRoutes(node.right, opts);
        }
    }
};

function parseRoutes (obj, opts) {
    if (obj.type == 'ObjectExpression') {
        obj.properties.forEach(function (prop) {
            observeProperty(prop, opts);
        });
    } else if (obj.type == 'FunctionExpression') {
        let returnedObjects = [],
            innerFunctionDeclaration = 0,
            innerFunctionExpression = 0;

        /*
         * Если это функция, разберем ее с помощью esprima.
         * Найдем return функции и проверим, является ли возвращаемое значение объектом.
         * Используя счетчик innerFunctionDeclaration, будем понимать, находимся мы в теле интересующей нас функции или функции, объявленной внутри нее.
         * На входе в узел декларации функции увеличиваем innerFunctionDeclaration, на выходе - уменьшаем.
         * Узел с типом ReturnStatement при innerFunctionDeclaration === 0 признаем соответствующим интересующей функции.
         * Поскольку return-ов может быть несколько, складываем их в объект для последующего анализа.
         */
        estraverse.traverse(obj.body, {
            enter: function (node) {

                if (node.type == 'FunctionDeclaration') {
                    innerFunctionDeclaration++;
                }

                if (node.type == 'FunctionExpression') {
                    innerFunctionExpression++;
                }

                if (node.type == 'ReturnStatement' && innerFunctionDeclaration === 0 && innerFunctionExpression === 0) {
                    if (node.argument && node.argument.type == 'ObjectExpression' && node.argument.properties) {
                        returnedObjects.push(node.argument.properties);
                    }
                }
            },
            leave: function (node) {

                if (node.type == 'FunctionDeclaration') {
                    innerFunctionDeclaration--;
                }

                if (node.type == 'FunctionExpression') {
                    innerFunctionExpression--;
                }
            }
        });

        returnedObjects = returnedObjects.filter(function (propArray) {
            if (propArray) {
                var allPropertiesCorrect = true;
                propArray.forEach(function (prop) {
                    var isCorrectProp = observeProperty(prop, opts);
                    allPropertiesCorrect = allPropertiesCorrect && isCorrectProp;
                });
                return allPropertiesCorrect;
            }
        });

        if (!returnedObjects.length) {
            onError(opts.file.path);
        }

    } else {
        onError(opts.file.path);
    }
}

function observeProperty (prop, opts) {
    if (prop.type == 'Property' && prop.key && prop.value && prop.key.type == 'Literal' &&
        prop.key.value.indexOf && prop.key.value.indexOf('/') == 0) {
        if (prop.value.type != 'Literal') {
            addToSource(opts, {
                url: prop.key.value,
                isMasterPage: false,
                controller: null
            })
        } else {
            var
                valueInfo = checkInContents(prop.value.value, opts),
                isMasterPage = valueInfo.isMasterPage,
                controller = valueInfo.controller;

            addToSource(opts, {
                url: prop.key.value,
                isMasterPage: isMasterPage,
                controller: controller
            })
        }

        return true;
    }
}

function addToSource (opts, info) {
    let routePath;
    if (/[\/\\]ws[\/\\]?$/i.test(opts.file.base)) {
        routePath = path.join('ws', opts.file.relative)
    } else {
        routePath = path.join('resources', translit(opts.file.relative));
    }
    if (!(routePath in opts.acc.routesInfo)) {
        opts.acc.routesInfo[routePath] = {};
        opts.acc.routesInfo[routePath][info.url] = {
            isMasterPage: info.isMasterPage,
            controller: info.controller
        };

        let file = opts.file;
        if (!file.__WS) {
            let module = translit(file.relative.split(/[\\/]/)[0]);
            opts.acc.modulesRoutesInfo[module][routePath] = {};
            opts.acc.modulesRoutesInfo[module][routePath][info.url] = {
                isMasterPage: info.isMasterPage,
                controller: info.controller
            };
        } else {
            opts.acc.modulesRoutesInfo.ws[routePath] = {};
            opts.acc.modulesRoutesInfo.ws[routePath][info.url] = {
                isMasterPage: info.isMasterPage,
                controller: info.controller
            };
        }
    } else if (info.url in opts.acc.routesInfo[routePath]) {
        // FIXME: при инкрементальной сборке валимся сюда иногда
        // throw Error(opts.file.path + ': обнаружено неоднократное переопределение контроллера для урла ' + info.url);
        gutil.log(opts.file.path + ': обнаружено неоднократное переопределение контроллера для урла ' + info.url);
    } else {
        opts.acc.routesInfo[routePath][info.url] = {
            isMasterPage: info.isMasterPage,
            controller: info.controller
        };
        let file = opts.file;
        if (!file.__WS) {
            let module = translit(file.relative.split(/[\\/]/)[0]);
            opts.acc.modulesRoutesInfo[module][routePath][info.url] = {
                isMasterPage: info.isMasterPage,
                controller: info.controller
            };
        } else {
            opts.acc.modulesRoutesInfo.ws[routePath][info.url] = {
                isMasterPage: info.isMasterPage,
                controller: info.controller
            };
        }
    }
}

function checkInContents (key, opts) {
    return {
        isMasterPage: (key.toString().replace('js!', '') in opts.acc.contents.jsModules),
        controller: key
    }
}

function onError (filePath) {
    throw Error(path.basename(filePath) + ': модуль должен возвращать объект с урлами роутингов, начинающихся с "/" или синхронную функцию, которая возвращает такой объект');
}