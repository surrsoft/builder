'use strict';
const
   logger = require('../../lib/logger').logger();


//отсеиваем ошибки и сразу их логируем
function logWarnings(promiseBuildLess) {
   return new Promise((resolve, reject) => {
      promiseBuildLess.then(results => {
         const compiledLessList = [];
         for (const result of results) {
            if (result.hasOwnProperty('error')) {
               logger.warning({
                  error: result.error,
                  filePath: result.path
               });
            } else {
               compiledLessList.push(result);
            }
         }
         resolve(compiledLessList);
      }, error => {
         reject(error);
      });
   });
}

function buildLessTask(filesInfo, resourcePath, pool) {
   return function lessTask(done) {
      const sizeChunk = 20; //эмпирически подобранная величина для высокой производительности

      const promises = [];
      for (let i = 0; i < filesInfo.length; i += sizeChunk) {
         const temp = filesInfo.slice(i, i + sizeChunk);
         promises.push(logWarnings(pool.exec('buildLess', [temp, resourcePath])));
      }
      Promise.all(promises).then(
         results => {
            for (const compiledLessList of results) {
               for (const compiledLess of compiledLessList) {
                  logger.info(JSON.stringify(compiledLess.imports));
               }
            }
            done();
         }, error => {
            logger.error({error: error});
            done();
         });
   };
}

module.exports = buildLessTask;
