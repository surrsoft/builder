/**
 * Корректный вариант скомпиленной библиотеки с внутренними рекурсивными
 * приватными зависимостями
 */

define('Modul/Modul', [
    'require',
    'exports',
    'Modul/_es6/Modul'
], function (require, exports, Modul_es_1) {
    'use strict';
    Object.defineProperty(exports, '__esModule', { value: true });
    exports.default = Modul_es_1.default;
});
