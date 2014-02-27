/**
 * Created by shilovda on 25.02.13.
 */

var path = require('path');

(function () {

   "use strict";

   function packer(grunt, files, root) {
      var packedCss, imports;
      packedCss = files.map(function(css){
         var code = grunt.file.read(css),
            cssDir = path.dirname(css),
            matchResult = code.match(/url\((?!("|')?data:)[^#\)]+?\)/ig);
         if(matchResult) {
            matchResult.forEach(function(match){
               var parts = match.match(/url\((?:"|'|\s)?([^"'\s]+?)(?:"|'|\s)?\)/i);

               if(parts) {
                  var url;
                  if(parts[1].charAt(0) == '/')
                     url = parts[1];
                  else
                     url = '/' + path.relative(root, path.resolve(cssDir, parts[1]));
                  code = code.replace(match, "url('" + url.replace(/\\/g, '/') + "')");
               }
            });
         }
         return code;
      }).join('\n');

      // bump imports up
      imports = packedCss.match(/@import[^;]+;/ig);
      if(imports) {
         imports.forEach(function(anImport){
            packedCss = packedCss.replace(anImport, '');
         });
         packedCss = imports.join("\n") + packedCss;
      }

      return packedCss;
   }

   module.exports = {

      packageDictionary: function(grunt, data, application) {
         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Выполняется паковка словарей.');

         var languages = {}, paths = {};
         // Рекурсивно проходим по папке, находим все словари, и находм все css файлы. Заполняем массивы
         grunt.file.recurse(path.join('./', application), function(absPath) {
            var language = absPath.match(data.dict);
            if (language && language[1]) {
               var country = language[1].substr(3,2).toUpperCase(),
                   lang = language[1].substr(0,2).toLowerCase() + '-' + country,
                   cssPath;

               languages[lang] = languages[lang] || {css: [], json: []};
               languages[lang].json.push(absPath);

               cssPath = absPath.replace('.json', '.css');
               if (grunt.file.exists(cssPath)) {
                  languages[lang].css.push(cssPath);
               }

               cssPath = cssPath.replace(new RegExp(lang, 'g'), country);
               if (grunt.file.exists(cssPath)) {
                  languages[lang].css.push(cssPath);
               }
            }
         });

         // Компануем все в большие файлы
         Object.keys(languages).forEach(function(lang) {
            var dictionary = {}, css;
            languages[lang].json.forEach(function(jsonPath) {
               try {
                  var dict = grunt.file.readJSON(jsonPath);
                  Object.keys(dict || {}).forEach(function(prop) {
                     dictionary[prop] = dict[prop];
                  });
               } catch(e) {
                  grunt.log.error('Can\'t read ' + jsonPath);
               }
            });

            css = packer(grunt, languages[lang].css, data.packages);

            paths[lang] = paths[lang] || {};
            paths[lang].json = path.join(data.packages, lang + '.json');
            paths[lang].css = path.join(data.packages, lang + '.css');

            grunt.file.write(paths[lang].json, JSON.stringify(dictionary, null, 2));
            grunt.file.write(paths[lang].css, css);
         });

         // Записываем
         // Вычитываем contents.json, пробегаемся по dictionary, а потом заменяем пути
         try {
            var content = grunt.file.readJSON(path.join(application, 'resources/contents.json'));
            if (content) {
               var del = [];
               Object.keys(content.dictionary).forEach(function(key) {
                  var language = key.match(/\.(..-..|..)\.(json|css)/),
                      lang = language && language[1],
                      type = language && language[2];

                  if (!lang || !type)
                     return;

                  if (lang.length == 5) {
                     content.dictionary[key] = type === 'json' ? paths[lang].json : paths[lang].css;
                  } else if (lang.length == 2) {
                     del.push(key);
                  }
               });

               del.forEach(function(key) {
                  delete content.dictionary[key];
               });

               grunt.file.write(path.join(application, 'resources/contents.json'), JSON.stringify(content, null, 2));
            }
         } catch(e) {
            grunt.log.error('Can\'t read contents.json file - ' + e);
         }

         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Паковка словарей выполнена.');
      }
   }
})();