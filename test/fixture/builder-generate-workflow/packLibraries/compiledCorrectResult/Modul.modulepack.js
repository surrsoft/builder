/* eslint-disable */

/**
 * Корректный вариант скомпиленной библиотеки с внутренними рекурсивными
 * приватными зависимостями, которые были в полном составе упакованы в
 * саму библиотеку.
 */

define('Modul/Modul', ['tslib'], function (tslib_1) {
    'use strict';
    Object.defineProperty(exports, '__esModule', { value: true });
        var Modul_2 = function () {
        var exports = {};
        var result = function (require, exports, tslib_1) {
            'use strict';
            Object.defineProperty(exports, '__esModule', { value: true });
            function prepareOptions(param1, param2) {
                return tslib_1.__awaiter(this, void 0, void 0, function () {
                    return tslib_1.__generator(this, function (_a) {
                        return [
                            2,
                            { sum: param1 + param2 }
                        ];
                    });
                });
            }
            exports.default = prepareOptions;
        }(require, exports, tslib_1);
        for (var property in result) {
            if (result.hasOwnProperty(property)) {
                exports[property] = result[property];
            }
        }
        return exports;
    }();
        var Module_js_1 = function () {
        var exports = {};
        var result = function (require, exports, tslib_1, Modul_2) {
            'use strict';
            return {
                Modul_1: Modul_2,
                default: Modul_2
            };
        }(require, exports, tslib_1, Modul_2);
        for (var property in result) {
            if (result.hasOwnProperty(property)) {
                exports[property] = result[property];
            }
        }
        return exports;
    }();
        var Modul_es_1 = function () {
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
        }(require, exports, Module_js_1);
        for (var property in result) {
            if (result.hasOwnProperty(property)) {
                exports[property] = result[property];
            }
        }
        return exports;
    }();
    exports.default = Modul_es_1.default;
    
    return exports;
});
