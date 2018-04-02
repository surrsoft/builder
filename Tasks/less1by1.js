'use strict';

const helpers = require('../lib/helpers'),
   transliterate = require('../lib/transliterate'),
   logger = require('../lib/logger').logger(),
   buildLess = require('../lib/build-less'),
   fs = require('fs-extra'),
   path = require('path'),
   pMap = require('p-map');

module.exports = function less1by1Task(grunt) {
   const root = grunt.option('root') || '',
      app = grunt.option('application') || '',
      modulesOption = (grunt.option('modules') || '').replace('"', ''),
      rootPath = path.join(root, app),
      resourcePath = path.join(rootPath, 'resources');

   grunt.registerMultiTask('less1by1', 'Задача компиляци less в css. Поддерживает темы', async function() {
      logger.debug('Запускается задача less1by1.');

      const taskDone = this.async(); //eslint-disable-line no-invalid-this

      try {
         if (!modulesOption) {
            logger.error('Parameter "modules" not found');
            return;
         }
         const modulesPaths = grunt.file.readJSON(modulesOption);
         if (!Array.isArray(modulesPaths)) {
            logger.error('Parameter "modules" incorrect');
            return;
         }

         let sbis3ControlsPath = '';
         for (const modulePath of modulesPaths) {
            if (path.basename(modulePath) === 'SBIS3.CONTROLS') {
               sbis3ControlsPath = modulePath;
            }
         }

         await pMap(modulesPaths, async(modulePath) => {
            const files = [];
            const moduleName = path.basename(modulePath);
            await helpers.recursiveReadDir(modulePath, files, '.less');
            await pMap(files, async(lessFilePath) => {
               try {
                  const cssFilePath = lessFilePath.replace('.less', '.css');
                  if (await fs.pathExists(cssFilePath)) {
                     //если файл уже есть, то не нужно его перезаписывать.
                     //иначе при деплое локального стенда мы перезапишем css в исходниках.
                     //просто ругаемся и ждём, что поправят.
                     const message = `Существующий CSS-файл мешает записи результата компиляции '${lessFilePath}'. ` +
                        'Необходимо удалить лишний CSS-файл';

                     logger.warning({
                        message: message,
                        filePath: cssFilePath
                     });
                     return;
                  }

                  const data = await fs.readFile(lessFilePath);
                  const result = await buildLess(lessFilePath, data.toString(), modulePath, sbis3ControlsPath);
                  if (result.ignoreMessage) {
                     logger.debug(result.ignoreMessage);
                  } else {
                     const relativeLessFilePath = path.relative(modulePath, lessFilePath);
                     const relativeResultCssFilePath = transliterate(path.join(moduleName, relativeLessFilePath.replace('.less', '.css')));
                     const resultCssPath = path.join(resourcePath, relativeResultCssFilePath);
                     await fs.writeFile(resultCssPath, result.text, {flag: 'w'});
                     logger.debug(`file ${resultCssPath} successfully compiled`);
                  }

               } catch (error) {
                  logger.warning({
                     message: 'Ошибка при компиляции less файла',
                     error: error,
                     filePath: lessFilePath
                  });
               }
            }, {
               concurrency: 10
            });
         }, {
            concurrency: 2
         });

         logger.debug('Задача less1by1 выполнена.');
      } catch (error) {
         logger.error({
            message: 'Ошибка при выполнении задачи less1by1',
            error: error
         });
      }
      taskDone();
   });
};
