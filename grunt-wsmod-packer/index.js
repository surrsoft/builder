/**
 * Функции паковки, которые вызываются на препроцессоре
 */

var modDeps = require('./lib/moduleDependencies');
var packInOrder = require('./tasks/lib/packInOrder');
var collectModules = require('./tasks/lib/collectModules');
var customPackage = require('./tasks/lib/customPackage');
var packCSS = require('./tasks/lib/packCSS').packCSS;

module.exports = {
    /**
     * Формурет js и css пакеты по заданному набору модулей
     * @param {Array} modArray
     * @param {String} root
     * @param {String} appDir
     * @param {Function} callback
     */
    packModules: function (modArray, root, appDir, bundlesOptions, callback, themeName) {
        try {
            var dg = modDeps.getDependencyGraph(appDir);
            packInOrder(dg, modArray, root, appDir, false, bundlesOptions, callback, themeName);
        } catch (e) {
            callback(e);
        }
    },
    packModulesWithoutDefines: function (modArray, root, appDir, bundlesOptions, callback) {
        try {
            var dg = modDeps.getDependencyGraph(appDir);
            packInOrder(dg, modArray, root, appDir, true, bundlesOptions, callback);
        } catch (e) {
            callback(e);
        }
    },
    /**
     * Возвращает список путей до js и css, которые надо подключить к HTML странице
     * @param {Array} modArray
     * @param {String} appDir
     * @param {Function} callback
     */
    collectModules: function (modArray, appDir, bundlesOptions, callback, themeName) {
        try {
            var dg = modDeps.getDependencyGraph(appDir);
            collectModules(dg, modArray, bundlesOptions, callback, themeName);
        } catch (e) {
            callback(e);
        }
    },
    /**
     * Формурет js и css пакеты по заданному набору модулей, поддерживается фильтрация
     * @param {Object} config
     * @param {String} root
     * @param {String} appDir
     * @param {Function} callback
     */
    customPack: function (config, root, appDir, callback) {
        try {
            var dg = modDeps.getDependencyGraph(appDir);
            customPackage.createPackage(dg, config, root, appDir, callback);
        } catch (e) {
            callback(e);
        }
    },
    /**
     * @callback packCSS~callback
     * @param {Error} error
     * @param {String} [result]
     */
    /**
     * Пакует переданные css. Делит пакет на пачки по 4000 правил (ie8-9)
     * @param {Array.<String>} files - пути до файлов
     * @param {String} root - корень сайта
     * @param {packCSS~callback} callback
     */
    packCSS: packCSS
};
