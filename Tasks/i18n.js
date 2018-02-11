'use strict';

const
   path = require('path'),
   fs = require('fs'),
   logger = require('../lib/logger').logger(),
   indexDict = require('../lib/i18n/index-dictionary'),
   prepareXHTML = require('../lib/i18n/prepare-xhtml'),
   collectWords = require('../lib/i18n/collect-words'),
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

async function runCreateResultDict(modules, componentsProperties, out, done) {
   logger.info('Запускается построение результирующего словаря.');

   if (!out) {
      logger.error('Parameter "out" is not find');
      done();
      return;
   }

   if (!modules) {
      logger.error('Parameter "modules" is not find');
      done();
      return;
   }


   const paths = JSON.parse(fs.readFileSync(modules).toString());

   let curCountModule = 0;
   const words = [];

   for (let dir of paths) {
      const sourceFiles = global.grunt.file.expand({cwd: dir}, ['**/*.xhtml', '**/*.tmpl', '**/*.js']);
      for (let pathToSource of sourceFiles) {
         const absPath = path.join(dir, pathToSource);
         const text = fs.readSync(absPath).toString();
         let newWords = [];
         try {
            newWords = await collectWords(absPath, text, componentsProperties);
         } catch (error) {
            logger.error({
               message: 'Ошибка при сборе фраз для локализации',
               error: error,
               filePath: absPath
            });
         }
         Array.prototype.push.apply(words, newWords);
      }
      curCountModule += 1;
      const percent = curCountModule * 100 / paths.length;
      logger.progress(percent, 'UI ' + path.basename(dir));
   }

   // Записать в результирующий словарь
   try {
      fs.writeFileSync(out, JSON.stringify(words, null, 2));
   } catch (err) {
      logger.error({
         message: 'Could\'t create output file ',
         filePath: out,
         error: err
      });
   }

   logger.info('Построение результирующего словаря выполнено.');
   done();
}

module.exports = function(grunt) {
   grunt.registerMultiTask('i18n', 'Translate static', async function() {
      logger.info(grunt.template.today('hh:MM:ss') + ': Запускается задача i18n.');

      const taskDone = this.async();
      let taskCount = 0;
      let isDone = false;

      let options = new Map([
         ['modules', grunt.option('modules')],
         ['json-cache', grunt.option('json-cache')],
         ['out', grunt.option('out')],
         ['index-dict', grunt.option('index-dict')],
         ['make-dict', grunt.option('make-dict')],
         ['prepare-xhtml', grunt.option('prepare-xhtml')]
      ]);

      options = new Map(Array.from(options, ([k, v]) => {
         if (v) {
            return [k, v.replace(/"/g, '')];
         } else {
            return [k, v];
         }
      }));

      let componentsProperties;
      if (options.get('modules') && options.get('json-cache')) {
         componentsProperties = await runJsonGenerator(options.get('modules'), options.get('json-cache'));
      }

      //Приводит повторяющиеся ключи в словарях к единому значению
      options.get('index-dict') && normalizeKeyDict(this.data, options.get('index-dict'));

      options.get('make-dict') && runCreateResultDict(options.get('modules'), options.get('json-cache'), options.get('out'), ++taskCount && done);

      options.get('prepare-xhtml') && runPrepareXHTML(this.data.cwd, componentsProperties, ++taskCount && done);

      options.get('index-dict') && indexDict(grunt, options.get('index-dict'), this.data, ++taskCount && done);

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
