'use strict';

/**
 * Created by fa.kolbeshin on 21.12.2017.
 */

var
   fs = require('fs'),
   uglifyJS = require('uglify-js'),
   humanize = require('humanize'),
   path = require('path'),
   async = require('async'),
   jsEXT = /\.js$/,
   tmplEXT = /\.tmpl$/,
   xhtmlEXT = /\.xhtml$/,
   logger = require('../lib/logger').logger();

module.exports = function uglifyJsTask(grunt) {
   grunt.registerMultiTask('uglify', 'Задача минификации JS', function() {
      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается задача uglify.`);
      const taskDone = this.async();
      var
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
         var availableFiles = getAvailableFiles(currentFile.src);
         if (availableFiles.length === 0) {
            grunt.log.warn('Destination ' + currentFile.dest + ' not written because src files were empty.');
            return;
         }
         availableFiles.forEach(function(file) {
            var
               currentPath = path.normalize(file),
               data = fs.readFileSync(currentPath, 'utf8'),
               dataObject = {},
               currentEXT = currentPath.match(jsEXT) ? jsEXT : currentPath.match(tmplEXT) ? tmplEXT : xhtmlEXT,
               currentEXTString = currentEXT.toString(),

               /**
                * если минифицируется обычная js-ка, то передаём правильный набор опций для
                * компрессии. Если же это шаблон, то достаточно mangle { eval: true }
                */
               minifyOptions = !data.match(/define\("(tmpl!|html!)/) ? {
                  /* eslint-disable id-match */
                  compress: {
                     sequences: true,
                     properties: false,
                     dead_code: true,
                     drop_debugger: true,
                     conditionals: false,
                     comparisons: false,
                     evaluate: false,
                     booleans: false,
                     loops: false,
                     unused: false,
                     hoist_funs: false,
                     if_return: false,
                     join_vars: true,
                     warnings: false, //всё равно их не ловим
                     negate_iife: false,
                     keep_fargs: true,
                     collapse_vars: true
                  }
                  /* eslint-enable id-match */
               } : {mangle: {eval: true}},
               sourceJSPath, sourceMapPath;

            currentEXTString = currentEXTString.slice(2, currentEXTString.length - 2);

            /**
             * Если шаблон не был сгенерен, тогда минифицировать нечего и обработку файла завершаем.
             */
            if (currentEXTString !== '.js' && !fs.existsSync(currentPath.replace(currentEXT, `.original${currentEXTString}`))) {
               grunt.log.ok('Generated template for ' + currentPath + 'doesnt exists. Skipped.');
               return;
            }
            if (isPresentationService) {
               sourceJSPath = currentPath.replace(currentEXT, `.source${currentEXTString}`);
               sourceMapPath = `${currentPath}.map`;
               fs.writeFileSync(sourceJSPath, data);
               if (currentEXTString === '.js') {
                  minifyOptions.sourceMap = {
                     url: path.basename(sourceMapPath)
                  };
               }
            }

            dataObject[path.basename(sourceJSPath ? sourceJSPath : currentPath)] = data;

            try {
               const minified = uglifyJS.minify(dataObject, minifyOptions);
               if (minified.error) {
                  logger.error({
                     message: 'Ошибка при минификации файла',
                     error: new Error(JSON.stringify(minified.error)),
                     filePath: sourceJSPath ? sourceJSPath : currentPath
                  });
               }
               if (!minified.error && minified.code) {
                  data = minified;
               }
            } catch (error) {
               logger.error({
                  message: `Ошибка в builder'е при минификации файла ${sourceJSPath ? sourceJSPath : currentPath}`,
                  error: error
               });
            }
            fs.writeFileSync(currentPath, data.code);
            if (isPresentationService) {
               fs.writeFileSync(sourceMapPath, data.map);
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
