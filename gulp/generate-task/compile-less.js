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
         console.log(`Less: ${chunk.length.toString()}: ${JSON.stringify(chunk)}`);
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

      //попытка оптимально использовать ядра процессора при небольшом количестве файлов.
      //less-темы гораздо тяжелее, чем less одного контрола и может возникнуть дизбаланс.
      //при этом количество файлов в одной чанке должно быть от 1 до maxSizeChunk
      let sizeChunk = Math.round(changedLessFiles.length / (os.cpus().length * 3));
      sizeChunk = Math.max(1, Math.min(maxSizeChunk, sizeChunk));
      console.log(`Less info: ${changedLessFiles.length.toString()}: ${sizeChunk} `);
      return Promise.all(splitArrayToChunk(changedLessFiles, sizeChunk).map(processChunk));
   };
}

module.exports = generateTaskForCompileLess;
