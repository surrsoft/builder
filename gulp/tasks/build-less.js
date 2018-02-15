'use strict';
const
   logger = require('../../lib/logger').logger();

function chunkArray(inputArray, sizeChunk) {
   const outputArray = [];
   for (let i = 0; i < inputArray.length; i += sizeChunk) {
      outputArray.push(inputArray.slice(i, i + sizeChunk));
   }
   return outputArray;
}

function buildLessTask(compileLessTasks, resourcePath, pool) {
   const sizeChunk = 20; //эмпирически подобранная величина для высокой производительности

   const processChunk = async function(chunk) {
      const results = await pool.exec('buildLess', [chunk, resourcePath]);
      const compiledLessList = [];
      for (const result of results) {
         if (result.hasOwnProperty('error')) {
            logger.warning({
               error: result.error,
               filePath: result.path,
               moduleInfo: compileLessTasks[result.path]
            });
         } else {
            compiledLessList.push(result);
         }
      }
      return compiledLessList;
   };

   return function buildLess() {
      const lessPaths = Object.keys(compileLessTasks).sort();
      return Promise.all(chunkArray(lessPaths, sizeChunk).map(processChunk));
   };
}

module.exports = buildLessTask;
