/**
 * Плагин для паковки в HTML.
 * Берёт корневой элемент и все зависимости пакует.
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   domHelpers = require('../../../packer/lib/domHelpers'),
   logger = require('../../../lib/logger').logger(),
   helpers = require('../../../lib/helpers'),
   packHtml = require('../../../packer/tasks/lib/packHTML'),
   execInPool = require('../../common/exec-in-pool');

/**
 * Объявление плагина
 * @param {DepGraph} gd граф зависмостей
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {Pool} pool пул воркеров
 * @returns {*}
 */
module.exports = function declarePlugin(gd, config, moduleInfo, pool) {
   const prettyOutput = helpers.prettifyPath(config.rawConfig.output);
   return through.obj(async function onTransform(file, encoding, callback) {
      try {
         if (file.extname !== '.html') {
            callback(null, file);
            return;
         }

         const [error, minText] = await execInPool(pool, 'minifyXhtmlAndHtml', [file.contents.toString()]);
         if (error) {
            logger.error({
               message: 'Ошибка при минификации html',
               error,
               moduleInfo,
               filePath: file.path
            });
         } else if (helpers.prettifyPath(path.dirname(path.dirname(file.path))) !== prettyOutput) {
            // если файл лежит не в корне модуля, то это скорее всего шаблон html.
            // используется в сервисе представлений для построения страниц на роутинге.
            // паковка тут не нужна, а минимизация нужна.
            file.contents = Buffer.from(minText);
         } else {
            let dom = domHelpers.domify(minText);
            const root = path.dirname(config.rawConfig.output),
               replacePath = !config.multiService;

            dom = await packHtml.packageSingleHtml(
               file.path,
               dom,
               root,
               'WI.SBIS/packer/modules',
               gd,
               config.urlServicePath,
               config.version,
               replacePath,
               config.rawConfig.output,
               config.localizations
            );

            file.contents = Buffer.from(domHelpers.stringify(dom));
         }
      } catch (error) {
         logger.error({
            message: 'Ошибка при паковке html',
            error,
            moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
