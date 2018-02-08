'use strict';

const
   path = require('path'),
   logger = require('../lib/logger').logger(),
   indexDict = require('../lib/i18n/index-dictionary'),
   prepareXHTML = require('../lib/i18n/prepare-xhtml'),
   createResultDict = require('../lib/i18n/create-result-dictionary'),
   runJsonGenerator = require('../lib/i18n/run-json-generator'),
   normalizeKeyDict = require('../lib/i18n/normalize-key');

/**
 * Подготавливаем ресурсы к переводу
 * Находит все xhtml файлы, разбирает их, и выискивает слова для перевода
 * Нужные слова обрамляет {[  ]}, для перевода с помощью шаблонизатора
 * Работаем по алгоритму:
 * 1 - ищем все xhtml файлы
 * 2 - разбираем их, и выискиваем простые текстовые ноды и компоненты
 * 3 - простые текстовые ноды просто обрамляем {[]}
 * 4 - Для компонента ищем его json файл с описанием
 * 5 - Если нашли файл с описанием, переводим внутренности, которые того требуют и уходим в глубь
 */
function runPrepareXHTML(root, componentsProperties, done) {
   try {
      logger.info('Подготавливаем xhtml файлы для локализации.');

      // Находим все xhtml файлы
      global.grunt.file.recurse(root, function(absPath, rootDir, subDir, fileName) {
         if (/\.xhtml$/.test(fileName)) {
            try {
               const text = global.grunt.file.read(absPath);
               if (text) {
                  global.grunt.file.write(absPath, prepareXHTML(text, componentsProperties));
               }
            } catch (err) {
               logger.error({
                  message: 'Error on localization XHTML',
                  filePath: absPath,
                  error: err
               });

            }
         }
      });
      logger.info('Подготовка xhtml файлов для локализации выполнена.');
   } catch (err) {
      logger.error({error: err});
   }
   done();
}

module.exports = function(grunt) {
   grunt.registerMultiTask('i18n', 'Translate static', async function() {
      logger.info(grunt.template.today('hh:MM:ss') + ': Запускается задача i18n.');

      const taskDone = this.async();
      let taskCount = 0;
      let isDone = false;

      let modules = grunt.option('modules');
      if (modules) {
         modules = modules.replace(/"/g, '');
      }
      let cache = grunt.option('json-cache');
      if (cache) {
         cache = cache.replace(/"/g, '');
      }
      const jsonOutput = cache || path.join(__dirname, '../../../../jsDoc-json-cache');
      let componentsProperties;
      if (modules) {
         componentsProperties = await runJsonGenerator(modules, jsonOutput);
      }

      //Приводит повторяющиеся ключи в словарях к единому значению
      grunt.option('index-dict') && normalizeKeyDict(grunt, this.data, grunt.option('index-dict'));

      grunt.option('make-dict') && createResultDict(grunt, ++taskCount && done);

      grunt.option('prepare-xhtml') && runPrepareXHTML(this.data.cwd, componentsProperties, ++taskCount && done);

      grunt.option('index-dict') && indexDict(grunt, grunt.option('index-dict'), this.data, ++taskCount && done);

      if (taskCount === 0) {
         done();
      }

      function done(err) {
         if (err) {
            logger.error({error: err});
         }

         if (!isDone && --taskCount <= 0) {
            logger.info(grunt.template.today('hh:MM:ss') + ': Задача i18n выполнена.');
            isDone = true;
            taskDone();
         }
      }

      return true;
   });
};
