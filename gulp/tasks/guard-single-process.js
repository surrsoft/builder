'use strict';

//Задача для предотвращения множественного запуска builder'а на одном кеше для предсказуемого результата.
const
   logger = require('../../lib/logger').logger(),
   path = require('path'),
   fs = require('fs-extra'),
   PluginError = require('plugin-error');

let lockFle;

module.exports = {
   'lock': async function lock(dir) {
      await fs.ensureDir(dir);

      lockFle = path.join(dir, 'builder.lockfile');

      return async(done) => {
         const isFileExist = await fs.pathExists(lockFle);
         if (isFileExist) {
            const errorMessage = 'Похоже, что запущен другой процесс builder в этой же папке, попробуйте перезапустить его позже. ' +
               `Если вы уверены, что предыдущий запуск завершился, то удалите файл '${lockFle}' и перезапустите процесс.`;

            logger.error(errorMessage);
            throw new PluginError({
               plugin: 'Guard single process',
               message: errorMessage
            });

         } else {
            await fs.ensureFile(lockFle);
            logger.debug(`Создали файл '${lockFle}'`);
            done();
         }
      };
   },
   'unlock': function unlock() {
      return async(done) => {
         const isFileExist = await fs.pathExists(lockFle);
         if (!isFileExist) {
            const errorMessage = `В процессе выполнения кто-то удалил файл '${lockFle}'. ` +
               'Нет гарантий, что результат не пострадал. Перезапустите процесс.';

            logger.error(errorMessage);
            throw new PluginError({
               plugin: 'Guard single process',
               message: errorMessage
            });

         } else {
            await fs.remove(lockFle);
            logger.debug(`Удалили файл '${lockFle}'`);
            done();
         }
      };
   }
};
