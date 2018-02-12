'use strict';
const
   os = require('os'),
   path = require('path'),
   workerPool = require('workerpool'),
   logger = require('../../lib/logger').logger();


//отсеиваем ошибки и сразу их логируем
function logWarnings(promiseBuildLess) {
   return new Promise((resolve, reject) => {
      promiseBuildLess.then(results => {
         const compiledLessList = [];
         for (let result of results) {
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

function buildLessTask(filesInfo, resourcePath) {
   return function lessTask(done) {
      const pool = workerPool.pool(
         path.join(__dirname, '../workers/build-less-worker.js'),
         {
            maxWorkers: os.cpus().length
         });
      const terminatePoolAndDone = () => {
         pool.terminate().then(() => {
            done();
         });
      };
      const sizeChunk = 20; //эмпирически подобранная величина для высокой производительности

      const promises = [];
      for (let i = 0; i < filesInfo.length; i += sizeChunk) {
         const temp = filesInfo.slice(i, i + sizeChunk);
         promises.push(logWarnings(pool.exec('buildLess', [temp, resourcePath])));
      }
      Promise.all(promises).then(
         results => {
            for (let compiledLessList of results) {
               for (let compiledLess of compiledLessList) {
                  logger.info(JSON.stringify(compiledLess.imports));
               }
            }
            terminatePoolAndDone();
         }, error => {
            logger.error({error: error});
            terminatePoolAndDone();
         });
   };
}

module.exports = buildLessTask;
