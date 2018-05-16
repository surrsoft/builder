/* eslint-disable no-invalid-this */

'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   path = require('path'),
   transliterate = require('../../../lib/transliterate'),
   helpers = require('../../../lib/helpers'),
   logger = require('../../../lib/logger').logger();

module.exports = function(config, changesStore, moduleInfo, pool) {
   const componentsPropertiesFilePath = path.join(config.cachePath, 'components-properties.json');

   return through.obj(async function(file, encoding, callback) {
      try {
         if (!file.path.endsWith('.html.tmpl')) {
            callback(null, file);
            return;
         }

         const relativeTmplPath = path.relative(moduleInfo.path, file.history[0]);
         const relativeTmplPathWithModuleName = helpers.prettifyPath(
            path.join(path.basename(moduleInfo.path), relativeTmplPath)
         );

         const result = await pool.exec('buildHtmlTmpl', [
            file.contents.toString(),
            file.history[0],
            relativeTmplPathWithModuleName,
            componentsPropertiesFilePath
         ]);
         const outputPath = path.join(moduleInfo.output, transliterate(relativeTmplPath)).replace('.tmpl', '');
         changesStore.addOutputFile(file.history[0], outputPath);
         this.push(
            new Vinyl({
               base: moduleInfo.output,
               path: outputPath,
               contents: Buffer.from(result)
            })
         );

         moduleInfo.staticTemplates[path.basename(outputPath)] = relativeTmplPathWithModuleName.replace('.tmpl', '');
      } catch (error) {
         changesStore.markFileAsFailed(file.history[0]);
         logger.error({
            message: 'Ошибка при обработке html-tmpl шаблона',
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.history[0]
         });
      }
      callback(null, file);
   });
};
