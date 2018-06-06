'use strict';

const
   fs = require('fs-extra'),
   humanize = require('humanize'),
   path = require('path'),
   async = require('async'),
   runUglifyJs = require('../lib/run-uglify-js'),
   extensions = [/(\.modulepack)?(\.js)$/, /\.tmpl$/, /\.xhtml$/, /\.jstpl$/, /\.json$/],
   helpers = require('../lib/helpers'),
   logger = require('../lib/logger').logger();

function getCurrentEXT(currentPath) {
   for (let i = 0; i < extensions.length; i++) {
      if (currentPath.match(extensions[i])) {
         //если расширение .js или .modulepack.js, надо вернуть полный результат
         if (i === 0) {
            return currentPath.match(extensions[i])[0];
         }
         return extensions[i];
      }
   }
}

/**
 * Функция возвращает путь до минифицированного файла в зависимости от расширения
 * и паковки собственных зависимостей
 * @String currentPath - путь до оригинала
 * @RegExp currentEXT - текущее расширение
 * @String currentEXTString
 * @returns {String} minModulePath
 */
function getMinModulePath(currentPath, currentEXT, currentEXTString) {
   switch (currentEXTString) {
      case '.xhtml':
      case '.tmpl':
         return currentPath;
      case '.js':
         let ext = '';

         //packed own dependencies
         if (fs.existsSync(currentPath.replace(currentEXT, '.modulepack.js'))) {
            ext = '.min.original.js';
         } else {
            ext = '.min.js';
         }
         return currentPath.replace(currentEXT, ext);
      default:
         return currentPath.replace(currentEXT, `.min${currentEXTString.replace('.modulepack', '')}`);
   }
}

module.exports = function uglifyJsTask(grunt) {
   grunt.registerMultiTask('uglify', 'Задача минификации JS', function() {
      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается задача uglify.`);
      const
         taskDone = this.async(),
         applicationRoot = path.join(this.data.root, this.data.application),

         /**
          * Опция splittedCore описывает, распиленное ядро или обычное мы используем.
          * Она нам пригодится, чтобы на Препроцессоре не генерить SourceMaps, поскольку в целях отладки
          * там присутствует /debug
          */
         splittedCore = this.data.splittedCore,
         getAvailableFiles = function(filesArray) {
            return filesArray.filter(function(filepath) {
               if (!grunt.file.exists(filepath)) {
                  logger.warning('Source file ' + filepath + ' not found');
                  return false;
               }
               return true;
            });
         };

      let
         mDeps = JSON.parse(fs.readFileSync(path.join(applicationRoot, 'resources', 'module-dependencies.json'))),
         nodes = Object.keys(mDeps.nodes);

      // Iterate over all src-dest file pairs.
      async.eachSeries(this.files, function(currentFile, done) {
         const availableFiles = getAvailableFiles(currentFile.src);
         if (availableFiles.length === 0) {
            logger.warning('Destination ' + currentFile.dest + ' not written because src files were empty.');
            return;
         }
         availableFiles.forEach(function(file) {
            const
               currentPath = path.normalize(file),
               originalText = fs.readFileSync(currentPath, 'utf8'),
               isMarkup = originalText.match(/define\("(tmpl!|html!)/),
               currentEXT = getCurrentEXT(currentPath);

            let
               currentEXTString = currentEXT.toString(),
               currentNodePath = helpers.prettifyPath(helpers.removeLeadingSlash(currentPath.replace(applicationRoot, '')).replace('.modulepack', '')),
               currentNode = nodes.filter(function(node) {
                  return helpers.prettifyPath(mDeps.nodes[node].path) === currentNodePath;
               }),
               sourceMapUrl, minModulePath, minMapPath;

            currentEXTString = currentEXTString.match(/\.js$/) ? currentEXTString : currentEXTString.slice(2, currentEXTString.length - 2);

            /**
             * Если шаблон не был сгенерен, тогда минифицировать нечего и обработку файла завершаем.
             */
            if ((currentEXTString.match(extensions[1]) || currentEXTString.match(extensions[2])) && !isMarkup) {
               logger.debug(`Template ${currentPath} doesnt generated. Check tmpl/xhtml-build task logs for errors. `);
               return;
            }
            if (splittedCore) {
               minModulePath = getMinModulePath(currentPath, currentEXT, currentEXTString);
               minMapPath = `${minModulePath}.map`;
               if (currentEXTString.match(extensions[0]) && !minModulePath.includes('.original.js')) {
                  sourceMapUrl = path.basename(minMapPath);
               }
            }

            const targetPath = minModulePath ? minModulePath : currentPath;

            try {
               if (splittedCore && currentEXTString === '.jstpl') {
                  /**
                   * jstpl копируем напрямую, их минифицировать никак нельзя,
                   * но .min файл присутствовать должен во избежание 404х
                   */
                  fs.writeFileSync(minModulePath, originalText);
               } else if (splittedCore && currentEXTString === '.json') {
                  /**
                   * Для json воспользуемся нативной функцией JSON.stringify, чтобы избавиться
                   * от табуляции и получить минифицированный вариант
                   */
                  try {
                     fs.writeFileSync(minModulePath, JSON.stringify(JSON.parse(originalText)));
                     if (splittedCore && currentNode.length > 0) {
                        currentNode.forEach(function(node) {
                           mDeps.nodes[node].path = mDeps.nodes[node].path.replace(currentEXT, '.min.json');
                        });
                     }
                  } catch (err) {
                     logger.error({
                        message: 'Проблема с парсингом и сохранением json-файла',
                        error: err,
                        filePath: currentPath
                     });
                  }
               } else {
                  /**
                   * для остальных модулей выполняем стандартную минификацию
                   */
                  const minified = runUglifyJs(currentPath, originalText, isMarkup, sourceMapUrl);

                  if (splittedCore && currentNode.length > 0 && currentEXTString === '.js') {
                     currentNode.forEach(function(node) {
                        mDeps.nodes[node].path = mDeps.nodes[node].path.replace(currentEXT, '.min.js');
                     });
                  }

                  fs.writeFileSync(targetPath, minified.code);
                  if (minified.hasOwnProperty('map') && minified.map) {
                     fs.writeFileSync(minMapPath, minified.map);
                  }
               }
            } catch (error) {
               logger.error({
                  message: 'Ошибка при минификации файла',
                  error: error,
                  filePath: currentPath
               });
               fs.writeFileSync(targetPath, originalText);
            }

         });

         /**
          * используем такой способ возвращения callback'а итеративной функции, поскольку
          * в противном случае мы получим переполнение размера стека вызовов. Подробнее
          * можно почитать здесь:
          * https://github.com/caolan/async/blob/master/intro.md#synchronous-iteration-functions
          */
         setImmediate(done);
      }, function(err) {
         if (err) {
            logger.error({
               error: err
            });
         }
         if (splittedCore) {
            fs.writeFileSync(path.join(applicationRoot, 'resources/module-dependencies.json'), JSON.stringify(mDeps, null, 3));
         }

         grunt.log.ok(`${humanize.date('H:i:s')} : Задача uglify выполнена.`);
         taskDone();
      });
   });
};
