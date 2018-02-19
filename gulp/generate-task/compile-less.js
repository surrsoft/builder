'use strict';
const
   logger = require('../../lib/logger').logger();

const sizeChunk = 2; //эмпирически подобранная величина для высокой производительности

function chunkArray(inputArray, sizeChunk) {
   const outputArray = [];
   for (let i = 0; i < inputArray.length; i += sizeChunk) {
      outputArray.push(inputArray.slice(i, i + sizeChunk));
   }
   return outputArray;
}

function generateTaskForCompileLess(changesStore, config, pool) {
   return function buildLess() {
      const compileLessTasks = changesStore.getChangedLessInfo();

      const processChunk = async function(chunk) {
         const results = await pool.exec('buildLess', [chunk, config.outputPath]);
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
               changesStore.setDependencies(result.path, result.imports);
            }
         }
         return compiledLessList;
      };

      const lessPaths = Object.keys(compileLessTasks).sort();
      return Promise.all(chunkArray(lessPaths, sizeChunk).map(processChunk));
   };
}

module.exports = generateTaskForCompileLess;
