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
      const changedLessFiles = changesStore.getChangedLessFiles();
      const moduleInfoForLess = changesStore.getModuleInfoForLess();

      const processChunk = async function(chunk) {
         console.log('Less: ' + JSON.stringify(chunk));
         const results = await pool.exec('buildLess', [chunk, config.outputPath]);
         const compiledLessList = [];
         for (const result of results) {
            if (result.hasOwnProperty('error')) {
               logger.warning({
                  error: result.error,
                  filePath: result.path,
                  moduleInfo: moduleInfoForLess[result.path]
               });
            } else {
               compiledLessList.push(result);
               changesStore.setDependencies(result.path, result.imports);
            }
         }
         return compiledLessList;
      };
      return Promise.all(chunkArray(changedLessFiles, sizeChunk).map(processChunk));
   };
}

module.exports = generateTaskForCompileLess;
