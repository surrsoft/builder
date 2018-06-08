'use strict';

const through = require('through2'),
   path = require('path'),
   domHelpers = require('../../../packer/lib/domHelpers'),
   logger = require('../../../lib/logger').logger(),
   packCss = require('../../../packer/tasks/lib/packCSS'),
   packJs = require('../../../packer/tasks/lib/packJS'),
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
               message: "Ошибка builder'а при минификации html",
               error,
               moduleInfo,
               filePath: file.path
            });
         } else {
            let dom = domHelpers.domify(text);
            const root = path.dirname(config.rawConfig.output),
               buildNumber = config.version,
               replacePath = !config.multiService;

            dom = await packCss.packageSingleCss(
               file.path,
               dom,
               root,
               path.join(config.rawConfig.output, 'WI.SBIS/packer/css'),
               buildNumber,
               true
            );
            dom = await packJs.packageSingleJs(
               file.path,
               dom,
               root,
               path.join(config.rawConfig.output, 'WI.SBIS/packer/js'),
               buildNumber,
               true
            );

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
            message: "Ошибка builder'а при паковке html",
            error,
            moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
