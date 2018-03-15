'use strict';

const
   path = require('path'),
   fs = require('fs'),
   async = require('async'),
   helpers = require('../lib/helpers'),
   logger = require('../lib/logger').logger(),
   indexDict = require('../lib/i18n/index-dictionary'),
   prepareXHTML = require('../lib/i18n/prepare-xhtml'),
   collectWords = require('../lib/i18n/collect-words'),
   runJsonGenerator = require('sbis3-json-generator/run-json-generator'),
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

function runCreateResultDictForDir(words, dir, componentsProperties) {
   return new Promise(function(resolve) {
      helpers.recurse(dir, function(filePath, fileDone) {
         if (!helpers.validateFile(filePath, ['**/*.xhtml', '**/*.tmpl', '**/*.js'])) {
            setImmediate(fileDone);
            return;
         }
         fs.readFile(filePath, async function readFileCb(readFileError, textBuffer) {
            if (readFileError) {
               logger.error({
                  message: 'Ошибка при чтении less файла',
                  error: readFileError,
                  filePath: filePath
               });
               setImmediate(fileDone);
               return;
            }
            try {
               const newWords = await collectWords(dir, filePath, textBuffer.toString(), componentsProperties);
               Array.prototype.push.apply(words, newWords);
            } catch (error) {
               logger.error({
                  message: 'Ошибка при сборе фраз для локализации',
                  error: error,
                  filePath: filePath
               });
            }
            setImmediate(fileDone);
         });
      }, function(err) {
         if (err) {
            logger.error({error: err});
         }
         resolve();
      });
   });
}


function runCreateResultDict(modules, componentsProperties, out) {
   return new Promise(function(resolve, reject) {
      try {
         logger.info('Запускается построение результирующего словаря.');

         if (!out) {
            return reject(new Error('Parameter "out" is not find'));
         }
         if (!modules) {
            return reject(new Error('Parameter "modules" is not find'));
         }

         const paths = JSON.parse(fs.readFileSync(modules).toString());

         let curCountModule = 0;
         const words = [];

         async.eachSeries(paths, function(dir, dirDone) {
            runCreateResultDictForDir(words, dir, componentsProperties)
               .then(
                  () => {
                     dirDone();
                     curCountModule += 1;
                     logger.progress(100 * curCountModule / paths.length, path.basename(dir));
                  },
                  (error) => {
                     dirDone(error);
                  });
         }, function(err) {
            if (err) {
               logger.error({error: err});
            }

            // Записать в результирующий словарь
            try {
               fs.writeFileSync(out, JSON.stringify(words, null, 2));
            } catch (error) {
               logger.error({
                  message: 'Could\'t create output file ',
                  filePath: out,
                  error: error
               });
            }

            logger.info('Построение результирующего словаря выполнено.');
            resolve();
         });
      } catch (error) {
         reject(error);
      }
   });
}

module.exports = function(grunt) {
   grunt.registerMultiTask('i18n', 'Translate static', async function() {
      logger.info(grunt.template.today('hh:MM:ss') + ': Запускается задача i18n.');

      const taskDone = this.async();
      let taskCount = 0;
      let isDone = false;

      const readOption = (name) => {
         const value = grunt.option(name);
         if (!value) {
            return value;
         }
         if (typeof value === 'string') {
            return value.replace(/"/g, '');
         }
         return value;
      };

      const optModules = readOption('modules'),
         optJsonCache = readOption('json-cache'),
         optOut = readOption('out'),
         optIndexDict = readOption('index-dict'),
         optMakeDict = readOption('make-dict'),
         optPrepareXhtml = readOption('prepare-xhtml'),
         optJsonGenerate = readOption('json-generate');

      let componentsProperties = {};
      if (optPrepareXhtml || optMakeDict || optJsonGenerate) {
         const resultJsonGenerator = await runJsonGenerator(optModules, optJsonCache);
         for (const error of resultJsonGenerator.errors) {
            logger.warning({
               message: 'Ошибка при разборе JSDoc комментариев',
               filePath: error.filePath,
               error: error.error
            });
         }
         componentsProperties = resultJsonGenerator.index;
         if (optMakeDict) {
            try {
               ++taskCount;
               await runCreateResultDict(optModules, componentsProperties, optOut);
               done();
            } catch (error) {
               logger.error({error: error});
            }
         }

         optPrepareXhtml && runPrepareXHTML(this.data.cwd, componentsProperties, ++taskCount && done);
      }

      if (optIndexDict) {
         normalizeKeyDict(this.data, optIndexDict); //Приводит повторяющиеся ключи в словарях к единому значению
         indexDict(grunt, optIndexDict, this.data, ++taskCount && done);
      }


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
