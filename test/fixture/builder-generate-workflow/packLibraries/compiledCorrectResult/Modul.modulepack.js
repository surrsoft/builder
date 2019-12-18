define('Modul/Modul', [
    'tslib',
    'i18n!Modul',
    'View/Executor/TClosure',
    'require',
    'exports',
    'css!theme?Modul/_es6/test'
], function (tslib_1, rk, thelpers, require, exports) {
    Object.defineProperty(exports, '__esModule', { value: true });
        exports['wml!Modul/_es6/test'] = true;
        var wml_Modul__es6_test = function () {
        var exports = {};
        var result = function (thelpers, rk) {
            function debug() {
                debugger;
            }
            var deps = Array.prototype.slice.call(arguments);
            var depsLocal = {};
            var includedTemplates = {};
            var templateFunction = function Modul__es6_test(data, attr, context, isVdom, sets) {
                var forCounter = 0;
                var templateCount = 0;
                var key = thelpers.validateNodeKey(attr && attr.key);
                var defCollection = {
                    id: [],
                    def: undefined
                };
                var viewController = thelpers.configResolver.calcParent(this, typeof currentPropertyName === 'undefined' ? undefined : currentPropertyName, data);
                var markupGenerator = thelpers.getMarkupGenerator(isVdom);
                try {
                    var out = markupGenerator.joinElements([markupGenerator.createTag('div', {
                            'attributes': { 'class': 'test' },
                            'events': typeof window === 'undefined' ? {} : {},
                            'key': key + '0_'
                        }, [], attr, defCollection, viewController)], key, defCollection);
                    if (defCollection && defCollection.def) {
                        out = markupGenerator.chain(out, defCollection, attr);
                        defCollection = undefined;
                    }
                } catch (e) {
                    thelpers.templateError('Modul/es6/test', e, data);
                }
                return out || markupGenerator.createText('');
            };
            templateFunction.stable = true;
            templateFunction.reactiveProps = [];
            return templateFunction;
        }(thelpers, rk);
        if (result instanceof Function) {
            return result;
        } else if (result && Object.getPrototypeOf(result) !== Object.prototype) {
            return result;
        } else {
            for (var property in result) {
                if (result.hasOwnProperty(property)) {
                    exports[property] = result[property];
                }
            }
        }
        return exports;
    }();
        exports['Modul/_es6/Modul2'] = true;
        var Modul__es6_Modul2 = function () {
        'use strict';
        var exports = {};
        var result = function (require, exports, tslib_1) {
            'use strict';
            Object.defineProperty(exports, '__esModule', { value: true });
            function prepareOptions(param1, param2) {
                return tslib_1.__awaiter(this, void 0, void 0, function () {
                    return tslib_1.__generator(this, function (_a) {
                        return [
                            2,
                            {
                                sum: param1 + param2,
                                tplFn: template
                            }
                        ];
                    });
                });
            }
            exports.default = prepareOptions;
        }(require, exports, tslib_1, typeof css_theme_Modul__es6_test === 'undefined' ? null : css_theme_Modul__es6_test, wml_Modul__es6_test);
        if (result instanceof Function) {
            return result;
        } else if (result && Object.getPrototypeOf(result) !== Object.prototype) {
            return result;
        } else {
            for (var property in result) {
                if (result.hasOwnProperty(property)) {
                    exports[property] = result[property];
                }
            }
        }
        return exports;
    }();
        exports['Modul/_es5/Module'] = true;
        var Modul__es5_Module = function () {
        'use strict';
        var exports = {};
        var result = function (require, exports, tslib_1, Modul_2) {
            'use strict';
            return {
                Modul_1: Modul_2,
                default: Modul_2
            };
        }(require, exports, tslib_1, Modul__es6_Modul2);
        if (result instanceof Function) {
            return result;
        } else if (result && Object.getPrototypeOf(result) !== Object.prototype) {
            return result;
        } else {
            for (var property in result) {
                if (result.hasOwnProperty(property)) {
                    exports[property] = result[property];
                }
            }
        }
        return exports;
    }();
        exports['Modul/_es6/Modul'] = true;
        var Modul__es6_Modul = function () {
        'use strict';
        var exports = {};
        var result = function (require, exports, Module_js_1) {
            'use strict';
            Object.defineProperty(exports, '__esModule', { value: true });
            exports.default = Module_js_1.default;
            function someTest() {
                var test1 = 'Тестовое сообщение';
                return test1;
            }
            exports.someTest = someTest;
        }(require, exports, Modul__es5_Module);
        if (result instanceof Function) {
            return result;
        } else if (result && Object.getPrototypeOf(result) !== Object.prototype) {
            return result;
        } else {
            for (var property in result) {
                if (result.hasOwnProperty(property)) {
                    exports[property] = result[property];
                }
            }
        }
        return exports;
    }();
        var Modul_es_1 = Modul__es6_Modul;
    exports.default = Modul_es_1.default;
    
    return exports;
});