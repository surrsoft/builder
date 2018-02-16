/* eslint-disable no-invalid-this */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   path = require('path'),
   convertHtmlTmpl = require('../../lib/convert-html-tmpl'),
   logger = require('../../lib/logger').logger();

module.exports = function(moduleInfo) {
   return through.obj(async function(file, encoding, callback) {
      this.push(file);
      if (!file.path.endsWith('.html.tmpl')) {
         callback();
         return;
      }
      try {
         const result = await convertHtmlTmpl(file.contents.toString(), file.path, {});
         const outFileName = file.basename.replace('.tmpl', '');

         this.push(new Vinyl({
            base: moduleInfo.output,
            path: path.join(moduleInfo.output, outFileName),
            contents: Buffer.from(result)
         }));

      } catch (error) {
         logger.error({
            message: 'Ошибка при обработке html-tmpl шаблона',
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.history[0]
         });
      }
      callback();
   });
};
