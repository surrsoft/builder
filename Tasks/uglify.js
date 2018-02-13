'use strict';

const
   fs = require('fs'),
   humanize = require('humanize'),
   path = require('path'),
   async = require('async'),
   runUglifyJs = require('../lib/run-uglify-js'),
   jsEXT = /\.js$/,
   tmplEXT = /\.tmpl$/,
   xhtmlEXT = /\.xhtml$/,
   logger = require('../lib/logger').logger();

module.exports = function uglifyJsTask(grunt) {
   grunt.registerMultiTask('uglify', 'Задача минификации JS', function() {
      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается задача uglify.`);
      const taskDone = this.async();
      const
         getAvailableFiles = function(filesArray) {
            return filesArray.filter(function(filepath) {
               if (!grunt.file.exists(filepath)) {
                  grunt.log.warn('Source file ' + filepath + ' not found');
                  return false;
               }
               return true;
            });
         },

         /**
          * Опция isPresentationService описывает, Препроцессор или Сервис Представлений мы используем.
          * Она нам пригодится, чтобы на Препроцессоре не генерить SourceMaps, поскольку в целях отладки
          * там присутствует /debug
          */
         isPresentationService = grunt.file.exists(path.join(process.env.ROOT, 'resources', 'WS.Core'));

      // Iterate over all src-dest file pairs.
      async.eachSeries(this.files, function(currentFile, done) {
         const availableFiles = getAvailableFiles(currentFile.src);
         if (availableFiles.length === 0) {
            grunt.log.warn('Destination ' + currentFile.dest + ' not written because src files were empty.');
            return;
         }
         availableFiles.forEach(function(file) {
            const
               currentPath = path.normalize(file),
               originalText = fs.readFileSync(currentPath, 'utf8'),
               isMarkup = originalText.match(/define\("(tmpl!|html!)/),
               currentEXT = currentPath.match(jsEXT) ? jsEXT : currentPath.match(tmplEXT) ? tmplEXT : xhtmlEXT;


            let sourceMapUrl,
               sourceJSPath,
               sourceMapPath,
               currentEXTString = currentEXT.toString();

            currentEXTString = currentEXTString.slice(2, currentEXTString.length - 2);

            /**
             * Если шаблон не был сгенерен, тогда минифицировать нечего и обработку файла завершаем.
             */
            if (currentEXTString !== '.js' && !fs.existsSync(currentPath.replace(currentEXT, `.original${currentEXTString}`))) {
               grunt.log.ok('Generated template for ' + currentPath + 'doesnt exists. Skipped.');
               return;
            }
            if (isPresentationService && !currentPath.includes('.original.js')) {
               sourceJSPath = currentPath.replace(currentEXT, `.source${currentEXTString}`);
               sourceMapPath = `${currentPath}.map`;
               fs.writeFileSync(sourceJSPath, originalText);
               if (currentEXTString === '.js') {
                  sourceMapUrl = path.basename(sourceMapPath);
               }
            }

            const targetPath = sourceJSPath ? sourceJSPath : currentPath;

            try {
               const minified = runUglifyJs(targetPath, originalText, isMarkup, sourceMapUrl);
               fs.writeFileSync(currentPath, minified.code);
               if (minified.hasOwnProperty('map') && minified.map) {
                  fs.writeFileSync(sourceMapPath, minified.map);
               }
            } catch (error) {
               logger.error({
                  message: 'Ошибка при минификации файла',
                  error: error,
                  filePath: targetPath
               });
               fs.writeFileSync(currentPath, originalText);
            }

         });

         /**
          * используем такой способ возвращения callback'а итеративной функции, поскольку
          * в противном случае мы получим переполнение размера стека вызовов. Подробнее
          * можно почитать здесь:
          * https://github.com/caolan/async/blob/master/intro.md#synchronous-iteration-functions
          */
         async.setImmediate(function() {
            done();
         });
      }, function(err) {
         if (err) {
            grunt.fail.fatal(err);
         }
         grunt.log.ok(`${humanize.date('H:i:s')} : Задача uglify выполнена.`);
         taskDone();
      });
   });
};
