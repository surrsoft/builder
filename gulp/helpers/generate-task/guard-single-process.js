'use strict';

// предотвращение множественного запуска builder'а на одном кеше для предсказуемого результата.
const
   logger = require('../../../lib/logger').logger(),
   path = require('path'),
   fs = require('fs-extra');

let lockFile;

function generateTaskForLock(cachePath) {
   return function lock() {
      return new Promise(async(resolve, reject) => {
         await fs.ensureDir(cachePath);
         lockFile = path.join(cachePath, 'builder.lockfile');

         const isFileExist = await fs.pathExists(lockFile);
         if (isFileExist) {
            const errorMessage = 'Похоже, что запущен другой процесс builder в этой же папке, попробуйте перезапустить его позже. ' +
               `Если вы уверены, что предыдущий запуск завершился, то удалите папку '${cachePath}' и перезапустите процесс.`;

            logger.error(errorMessage);
            reject(new Error(errorMessage));
            return;
         }
         await fs.ensureFile(lockFile);
         logger.debug(`Создали файл '${lockFile}'`);
         resolve();
      });
   };
}

function generateTaskForUnlock() {
   return function unlock() {
      return new Promise(async(resolve, reject) => {
         const isFileExist = await fs.pathExists(lockFile);
         if (!isFileExist) {
            const errorMessage = `В процессе выполнения кто-то удалил файл '${lockFile}'. ` +
               'Нет гарантий, что результат не пострадал. Перезапустите процесс.';

            logger.error(errorMessage);
            reject(new Error(errorMessage));
            return;
         }
         await fs.remove(lockFile);
         logger.debug(`Удалили файл '${lockFile}'`);
         resolve();
      });
   };
}

module.exports = {
   'generateTaskForLock': generateTaskForLock,
   'generateTaskForUnlock': generateTaskForUnlock
};
