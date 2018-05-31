'use strict';

const through = require('through2'),
   path = require('path'),
   domHelpers = require('../../../packer/lib/domHelpers'),
   logger = require('../../../lib/logger').logger(),
   packCss = require('../../../packer/tasks/lib/packCSS'),
   packJs = require('../../../packer/tasks/lib/packJS'),
   packHtml = require('../../../packer/tasks/lib/packHTML');

module.exports = function declarePlugin(gd, config, moduleInfo, pool) {
   return through.obj(async function onTransform(file, encoding, callback) {
      try {
         if (file.extname !== '.html' || path.dirname(path.dirname(file.path)) !== config.rawConfig.output) {
            callback(null, file);
            return;
         }

         let newText = file.contents.toString();
         newText = await pool.exec('minifyXhtmlAndHtml', [newText]);
         let dom = domHelpers.domify(newText);
         const root = path.dirname(config.rawConfig.output);

         dom = await packCss.packageSingleCss(
            file.path,
            dom,
            root,
            path.join(config.rawConfig.output, 'WI.SBIS/packer/css')
         );
         dom = await packJs.packageSingleJs(
            file.path,
            dom,
            root,
            path.join(config.rawConfig.output, 'WI.SBIS/packer/js')
         );
         const replacePath = !config.multiService;
         dom = await packHtml.packageSingleHtml(
            file.path,
            dom,
            root,
            'WI.SBIS/packer/modules',
            gd,
            '',
            config.version,
            replacePath,
            path.join(config.rawConfig.output, config.urlServicePath)
         );

         file.contents = Buffer.from(domHelpers.stringify(dom));
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
