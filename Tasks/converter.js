'use strict';

var path = require('path');
var fs = require('fs');
var async = require('async');
var mkdirp = require('mkdirp');
var transliterate = require('./../lib/utils/transliterate');

function mkSymlink(target, dest) {
   var link = function (target, dest) {
      try {
         fs.symlinkSync(target, dest);
      } catch (err) {
         if (err && err.code === 'ENOENT'){
            mkdirp.sync(path.dirname(dest));
            link(target, dest);
         }
      }
   };

   link(target, dest);
}

module.exports = function (grunt) {
   grunt.registerMultiTask('convert', 'transliterate paths', function () {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача конвертации ресурсов');
      var start = Date.now();

      var
         input = grunt.option('input'),
         symlink = grunt.option('symlink'),
         modules = (grunt.option('modules') || '').replace(/"/g, ''),
         root = grunt.option('root') || '',
         app = grunt.option('application') || '',
         i18n = !!grunt.option('index-dict'),
         rootPath = path.join(root, app),
         resourcesPath = path.join(rootPath, 'resources'),
         paths;

      if (modules) {
         paths = modules.split(';');

         if (paths.length == 1 && grunt.file.isFile(paths[0])) {
            input = paths[0];
            try {
               paths = grunt.file.readJSON(input);
               if (!Array.isArray(paths)) {
                  grunt.log.error('Parameter "modules" incorrect');
                  return;
               }
            } catch(e) {
               grunt.log.error('Parameter "modules" incorrect. Can\'t read ' + input);
               return;
            }
         }
      } else {
         paths = [input];
      }

      grunt.file.delete(resourcesPath, {
         force: true
      });

      paths.forEach(function (input) {
         var parts = input.split('/');
         var moduleName = parts[parts.length - 1] === 'resources' ? '' : parts[parts.length - 1];
         grunt.file.recurse(input, function (abspath) {
            var ext = path.extname(abspath);
            if (!symlink || (i18n && (ext == '.xhtml' || ext == '.html'))) {
               try {
                  grunt.file.copy(abspath, transliterate(path.join(resourcesPath, moduleName, path.relative(input, abspath))));
               } catch (err) {
                  grunt.log.error(err);
               }
            } else {
               mkSymlink(abspath, transliterate(path.join(resourcesPath, moduleName, path.relative(input, abspath))));
            }
         });
      });
      console.log('Duration: ' + (Date.now() - start));
   });
};