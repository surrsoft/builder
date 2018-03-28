'use strict';
const
   os = require('os'),
   path = require('path'),
   logger = require('../../../lib/logger').logger();

const maxSizeChunk = 20; //эмпирически подобранная величина для высокой производительности

function splitArrayToChunk(inputArray, sizeChunk) {
   const outputArray = [];
   for (let i = 0; i < inputArray.length; i += sizeChunk) {
      outputArray.push(inputArray.slice(i, i + sizeChunk));
   }
   return outputArray;
}

function generateTaskForCompileLess(changesStore, config, pool) {
   return async function buildLess() {
      const changedLessFiles = await changesStore.getChangedLessFiles();
      const moduleInfoForLess = changesStore.getModuleInfoForLess();

      const processChunk = async function(chunk) {
         try {
            logger.debug(`Compile LESS. Chunk length: ${chunk.length.toString()}. Chunk: ${JSON.stringify(chunk)}`);
            const results = await pool.exec('buildLess', [chunk, config.outputPath]);
            for (const result of results) {
               if (result.hasOwnProperty('error')) {
                  const moduleInfo = moduleInfoForLess[result.path];
                  const relativePath = path.relative(path.dirname(moduleInfo.output), result.path);
                  logger.warning({
                     error: result.error,
                     filePath: relativePath,
                     moduleInfo: moduleInfo
                  });
               } else if (result.ignoreMessage) {
                  logger.debug(result.ignoreMessage);
               } else {
                  changesStore.storeLessFileInfo(result.path, result.imports, result.path.replace('.less', '.css'));
               }
            }
         } catch (error) {
            logger.error({
               error: error
            });
         }
      };

      //попытка оптимально использовать ядра процессора при небольшом количестве файлов.
      //less-темы гораздо тяжелее, чем less одного контрола и может возникнуть дизбаланс.
      //при этом количество файлов в одной чанке должно быть от 1 до maxSizeChunk
      let sizeChunk = Math.round(changedLessFiles.length / (os.cpus().length * 3));
      sizeChunk = Math.max(1, Math.min(maxSizeChunk, sizeChunk));
      return Promise.all(splitArrayToChunk(changedLessFiles, sizeChunk).map(processChunk));
   };
}

module.exports = generateTaskForCompileLess;
