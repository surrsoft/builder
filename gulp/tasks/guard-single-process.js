'use strict';

//Задача для предотвращения множественного запуска builder'а на одном кеше для предсказуемого результата.
const
   logger = require('../../lib/logger').logger(),
   path = require('path'),
   fs = require('fs-extra'),
   PluginError = require('plugin-error');

let lockFle;

module.exports = {
   'lock': function lock(config) {
      return function lockGuard() {
         return new Promise(
            async(resolve, reject) => {
               const dir = config.cachePath;
               await fs.ensureDir(dir);
               lockFle = path.join(dir, 'builder.lockfile');

               const isFileExist = await fs.pathExists(lockFle);
               if (isFileExist) {
                  const errorMessage = 'Похоже, что запущен другой процесс builder в этой же папке, попробуйте перезапустить его позже. ' +
                     `Если вы уверены, что предыдущий запуск завершился, то удалите файл '${lockFle}' и перезапустите процесс.`;

                  logger.error(errorMessage);
                  reject(new PluginError({
                     plugin: 'Guard single process',
                     message: errorMessage
                  }));

               }
               await fs.ensureFile(lockFle);
               logger.debug(`Создали файл '${lockFle}'`);
               resolve();
            }
         );
      };
   },
   'unlock': function unlock() {
      return function unlockGuard() {
         return new Promise(
            async(resolve, reject) => {
               const isFileExist = await fs.pathExists(lockFle);
               if (!isFileExist) {
                  const errorMessage = `В процессе выполнения кто-то удалил файл '${lockFle}'. ` +
                     'Нет гарантий, что результат не пострадал. Перезапустите процесс.';

                  logger.error(errorMessage);
                  reject(new PluginError({
                     plugin: 'Guard single process',
                     message: errorMessage
                  }));

               } else {
                  await fs.remove(lockFle);
                  logger.debug(`Удалили файл '${lockFle}'`);
                  resolve();
               }
            }
         );
      };
   }
};
