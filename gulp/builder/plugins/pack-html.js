'use strict';

const through = require('through2'),
   path = require('path'),
   domHelpers = require('../../../packer/lib/domHelpers'),
   logger = require('../../../lib/logger').logger(),
   packCss = require('../../../packer/tasks/lib/packCSS'),
   packJs = require('../../../packer/tasks/lib/packJS');

module.exports = function declarePlugin(config, moduleInfo, pool) {
   return through.obj(async function onTransform(file, encoding, callback) {
      try {
         if (file.extname !== '.html' || path.dirname(path.dirname(file.path)) !== config.rawConfig.output) {
            callback(null, file);
            return;
         }

         let newText = file.contents.toString();
         newText = await pool.exec('minifyXhtmlAndHtml', [newText]);
         const dom = domHelpers.domify(newText);
         const root = path.dirname(config.rawConfig.output);

         await packCss.packageSingleCss(file.path, dom, root, path.join(config.rawConfig.output, 'WI.SBIS/packer/css'));
         await packJs.packageSingleJs(file.path, dom, root, path.join(config.rawConfig.output, 'WI.SBIS/packer/js'));

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
