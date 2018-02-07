'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   path = require('path'),
   buildLess = require('../../lib/build-less'),
   logger = require('../../lib/logger').logger();

module.exports = function(resourcePath) {
   let lessImports = '';
   return through.obj(async function(file, encoding, callback) {
      try {
         const result = await buildLess(file.path, file.contents.toString(), resourcePath);
         lessImports += file.path + ' imports: ' + JSON.stringify(result.imports, null, 3) + '\n';
         this.push(new Vinyl({
            base: resourcePath,
            path: path.join(path.dirname(file.path), result.fileName + '.css'),
            contents: new Buffer(result.text)
         }));
      } catch (error) {
         logger.warning({
            message: 'Ошибка при компиляции less',
            filePath: file.history[0],
            error: error
         });
      }
      callback(null, file);
   }, function(callback) {
      //TODO: убрать запись импортов в файл. они будут нужны для работы кеша
      callback(null, new Vinyl({
         base: resourcePath,
         path: path.join(resourcePath, 'less-imports.log'),
         contents: new Buffer(lessImports)
      }));

   });
};
