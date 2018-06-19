/**
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   domHelpers = require('../../../packer/lib/domHelpers'),
   logger = require('../../../lib/logger').logger(),
   packHtml = require('../../../packer/tasks/lib/packHTML'),
   execInPool = require('../../helpers/exec-in-pool');

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
               '',
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
