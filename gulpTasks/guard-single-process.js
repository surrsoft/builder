'use strict';

//Задача для предотвращения множественного запуска builder'а на одном кеше для предсказуемого результата.
const
   logger = require('./../lib/logger').logger(),
   path = require('path'),
   fs = require('fs'),
   mkdirp = require('mkdirp'),
   PluginError = require('plugin-error');

let lockFle;

module.exports = {
   'lock': function lock(dir) {
      if (!fs.existsSync(dir)) {
         mkdirp.sync(dir);
      }
      lockFle = path.join(dir, 'builder.lockfile');

      return (done) => {
         if (fs.existsSync(lockFle)) {
            const errorMessage = 'Похоже, что запущен другой процесс builder в этой же папке, попробуйте перезапустить его позже. ' +
               `Если вы уверены, что предыдущий запуск завершился, то удалите файл '${lockFle}' и перезапустите процесс.`;

            logger.error(errorMessage);
            throw new PluginError({
               plugin: 'Guard single process',
               message: errorMessage
            });

         } else {
            fs.closeSync(fs.openSync(lockFle, 'w'));
            logger.debug(`Создали файл \'${lockFle}'`);
            done();
         }
      };
   },
   'unlock': function unlock() {
      return (done) => {
         if (!fs.existsSync(lockFle)) {
            const errorMessage = `В процессе выполнения кто-то удалил файл '${lockFle}'. ` +
               'Нет гарантий, что результат не пострадал. Перезапустите процесс.';

            logger.error(errorMessage);
            throw new PluginError({
               plugin: 'Guard single process',
               message: errorMessage
            });

         } else {
            fs.unlinkSync(lockFle);
            logger.debug(`Удалили файл '${lockFle}'`);
            done();
         }
      };
   }
};
