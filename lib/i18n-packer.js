/**
 * Created by shilovda on 25.02.13.
 */

var path = require('path'),
    gruntCSSPacker = require('grunt-packer'),
    resolveUrl = gruntCSSPacker.resolveUrl,
    bumpImportsUp = gruntCSSPacker.bumpImportsUp;

(function () {

   "use strict";

   /**
    * Находит все пути до словарей и css
    * @param grunt
    * @param dictMask
    * @param application
    * @returns {{}}
    */
   function getDictionaryPath(grunt, dictMask, application) {
      var languages = {};
      grunt.file.recurse(path.join('./', application), function(absPath) {
         var language = absPath.match(dictMask);
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

      return languages;
   }

   /**
    * Отдает все пути до пакованных словарей и css
    * @param grunt
    * @param packages
    * @param languages
    * @returns {{}}
    */
   function getPackagesPath(grunt, packages, languages) {
      var paths = {};
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

         css = bumpImportsUp(languages[lang].css.map(function(css){
            return resolveUrl(packages, grunt.file.read(css), path.dirname(css));
         }).join('\n'));

         paths[lang] = paths[lang] || {};
         paths[lang].json = path.join(packages, lang + '.json').replace(/\\/g, '/');
         paths[lang].css = path.join(packages, lang + '.css').replace(/\\/g, '/');

         grunt.file.write(paths[lang].json, JSON.stringify(dictionary, null, 2));
         grunt.file.write(paths[lang].css, css);
      });

      return paths;
   }

   module.exports = {
      /**
       * Пакует словари и css файлы локализации
       * @param grunt
       * @param data
       * @param application
       */
      packageDictionary: function(grunt, data, application) {
         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Выполняется паковка словарей.');

         var languages = getDictionaryPath(grunt, data.dict, application),
             paths = getPackagesPath(grunt, data.packages, languages);
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
                     // Перед тем как удалить двухбуквенные, надо поискать, есть ли 5 буквенные
                     // Перебираем все языки и ищем те, которые заканчиваются на нужную страну
                     Object.keys(languages).forEach(function(avLang) {
                        if (avLang.toLowerCase().indexOf(lang.toLowerCase(), 3) !== -1 &&
                            content.dictionary[key.replace(new RegExp(lang + '.(json|css)', 'gi'), avLang + '.$1')]) {
                           del.push(key);
                        }
                     });
                  }
               });

               del.forEach(function(key) {
                  delete content.dictionary[key];
               });

               grunt.file.write(path.join(application, 'resources/contents.json'), JSON.stringify(content, null, 2));
               grunt.file.write(path.join(application, 'resources/contents.js'), 'contents = ' + JSON.stringify(content, null, 2));
            }
         } catch(e) {
            grunt.log.error('Can\'t read contents.json file - ' + e);
         }

         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Паковка словарей выполнена.');
      }
   }
})();