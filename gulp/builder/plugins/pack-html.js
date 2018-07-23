/**
 * Плагин для паковки в HTML.
 * Берёт корневой элемент и все зависимости пакует.
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   domHelpers = require('../../../packer/lib/dom-helpers'),
   logger = require('../../../lib/logger').logger(),
   packHtml = require('../../../packer/tasks/lib/pack-html'),
   execInPool = require('../../common/exec-in-pool');

/**
 * Объявление плагина
 * @param {DepGraph} gd граф зависмостей
 * @param {BuildConfiguration} config конфигурация сборки
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {Pool} pool пул воркеров
 * @returns {stream}
 */
module.exports = function declarePlugin(gd, config, moduleInfo, pool) {
   return through.obj(async function onTransform(file, encoding, callback) {
      try {
         if (file.extname !== '.html' || path.dirname(path.dirname(file.path)) !== config.rawConfig.output) {
            callback(null, file);
            return;
         }

         const [error, text] = await execInPool(pool, 'minifyXhtmlAndHtml', [file.contents.toString()]);
         if (error) {
            logger.error({
               message: 'Ошибка при минификации html',
               error,
               moduleInfo,
               filePath: file.path
            });
         } else {
            let dom = domHelpers.domify(text);
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
