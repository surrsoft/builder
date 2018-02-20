'use strict';
const
   os = require('os'),
   logger = require('../../lib/logger').logger();

const maxSizeChunk = 20; //эмпирически подобранная величина для высокой производительности

function splitArrayToChunk(inputArray, sizeChunk) {
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
      const countChunk = os.cpus().length * 3;
      const sizeChunk = Math.max(1, Math.min(maxSizeChunk, changedLessFiles.length / countChunk));

      return Promise.all(splitArrayToChunk(changedLessFiles, sizeChunk).map(processChunk));
   };
}

module.exports = generateTaskForCompileLess;
