'use strict';

const helpers = require('../lib/helpers'),
   logger = require('../lib/logger').logger(),
   buildLess = require('../lib/build-less'),
   fs = require('fs-extra'),
   path = require('path'),
   applicationRoot = path.join(process.env.ROOT, process.env.APPROOT);

module.exports = function less1by1Task(grunt) {
   const root = grunt.option('root') || '',
      app = grunt.option('application') || '',
      rootPath = path.join(root, app);

   grunt.registerMultiTask('less1by1', 'Компилит каждую лесску, ложит cssку рядом. Умеет в темы', function() {
      logger.debug('Запускается задача less1by1.');

      const taskDone = this.async(); //eslint-disable-line no-invalid-this

      helpers.recurse(rootPath, async function(filePath, cb) {
         try {
            const relativePath = path.relative(rootPath, filePath);
            if (!helpers.validateFile(relativePath, ['ws/**/*.less', 'resources/**/*.less'])) {
               cb();
               return;
            }

            const data = await fs.readFile(filePath);
            const resourcePath = path.join(applicationRoot, 'resources');
            const result = await buildLess(filePath, data.toString(), resourcePath);
            const newFullPath = filePath.replace('.less', '.css');

            if (result.ignoreMessage) {
               logger.debug(result.ignoreMessage);
            } else if (await fs.pathExists(newFullPath)) {
               //если файл уже есть, то не нужно его перезаписывать.
               //иначе при деплое локального стенда мы перезапишем css в исходниках.
               //просто ругаемся и ждём, что поправят.
               const message = `Существующий CSS-файл мешает записи результата компиляции '${filePath}'. ` +
                  'Необходимо удалить лишний CSS-файл';

               //монолитный ws уже должен быть со скомпилированными less, поэтому выводим не предупреждение, а просто информацию
               if (helpers.prettifyPath(newFullPath).includes('/ws/')) {
                  logger.info(message);
               } else {
                  logger.warning({
                     message: message,
                     filePath: newFullPath
                  });
               }
            } else {
               await fs.writeFile(newFullPath, result.text, {flag: 'w'});
               logger.debug(`file ${newFullPath} successfully compiled`);
            }
         } catch (error) {
            logger.warning({
               message: 'Ошибка при компиляции less файла',
               error: error,
               filePath: filePath
            });
         }
         cb();
      }, function() {
         logger.debug('Задача less1by1 выполнена.');
         taskDone();
      });
   });
};
