'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   path = require('path'),

   //buildLess = require('../../lib/build-less'),
   workerPool = require('workerpool'),
   logger = require('../../lib/logger').logger();

module.exports = function(moduleInfo) {
   let lessImports = '';
   const pool = workerPool.pool(path.join(__dirname, '../../lib/build-less-worker.js'));
   return through.obj(async function(file, encoding, callback) {
      try {
         const result = await pool.exec('buildLess', [file.path, path.dirname(moduleInfo.output)]);

         //const result = await buildLess(file.path, file.contents.toString(), path.dirname(moduleInfo.output));
         lessImports += file.path + ' imports: ' + JSON.stringify(result.imports, null, 3) + '\n';
         this.push(new Vinyl({
            base: moduleInfo.output,
            path: path.join(path.dirname(file.path), result.fileName + '.css'),
            contents: new Buffer(result.text)
         }));
      } catch (error) {
         logger.warning({
            message: 'Ошибка при компиляции less',
            filePath: file.history[0],
            error: error,
            moduleInfo: moduleInfo
         });
      }
      callback(null, file);
   }, function(callback) {
      pool.terminate();

      //TODO: убрать запись импортов в файл. они будут нужны для работы кеша
      callback(null, new Vinyl({
         base: moduleInfo.output,
         path: path.join(moduleInfo.output, 'less-imports.log'),
         contents: new Buffer(lessImports)
      }));

   });
};
