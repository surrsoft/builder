'use strict';

const helpers = require('../lib/helpers'),
   logger = require('../lib/logger').logger(),
   buildLess = require('../lib/build-less'),
   fs = require('fs'),
   path = require('path'),
   applicationRoot = path.join(process.env.ROOT, process.env.APPROOT);

module.exports = function less1by1Task(grunt) {
   const root = grunt.option('root') || '',
      app = grunt.option('application') || '',
      rootPath = path.join(root, app);

   grunt.registerMultiTask('less1by1', 'Компилит каждую лесску, ложит cssку рядом. Умеет в темы', function() {
      logger.debug('Запускается задача less1by1.');

      const taskDone = this.async();

      helpers.recurse(rootPath, function(filePath, cb) {
         const relativePath = path.relative(rootPath, filePath);
         if (helpers.validateFile(relativePath, ['ws/**/*.less', 'resources/**/*.less'])) {
            fs.readFile(filePath, async function readFileCb(readFileError, data) {
               if (readFileError) {
                  logger.error({
                     message: 'Ошибка при чтении less файла',
                     error: readFileError,
                     filePath: filePath
                  });
                  cb();
                  return;
               }
               try {
                  let resourcePath = path.join(applicationRoot, 'resources');
                  const result = await buildLess(filePath, data.toString(), resourcePath);
                  const newFullPath = path.join(path.dirname(filePath), result.fileName + '.css');
                  if (fs.existsSync(newFullPath)) {
                     logger.warning({
                        message: `Файл будет перезатёрт после компиляции ${filePath}`,
                        filePath: newFullPath
                     });
                  }
                  fs.writeFileSync(newFullPath, result.text, {flag: 'w'});
                  logger.debug(`file ${newFullPath} successfully compiled`);
               } catch (error) {
                  logger.warning({
                     message: 'Ошибка при компиляции less файла',
                     error: error,
                     filePath: filePath
                  });
               }
            });
         }
         cb();
      }, function() {
         logger.debug('Задача less1by1 выполнена.');
         taskDone();
      });

   });


};
