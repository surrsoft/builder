'use strict';

const helpers = require('./../utils/helpers');
const tmplLocalizator = require('./../i18n/tmplLocalizator');
const tmpl = global.requirejs('View/Builder/Tmpl');
const config = global.requirejs('View/config');
const tclosure = global.requirejs('View/Runner/tclosure');

function warnTmplBuild(err, fullPath) {
   var text = `resources error. An ERROR occurred while building template! ${err.message}, in file: ${fullPath}`;
   if (typeof grunt !== 'undefined') {
      grunt.log.warn(text);
   } else {
      console.log(text);
   }
}
function errorTmplBuild(err, fullPath) {
   var text = `Resources error. An ERROR occurred while building template!
    ---------File path: ${fullPath}`;
   if (typeof grunt !== 'undefined') {
      grunt.log.error(text);
      grunt.fail.fatal(err);
   } else {
      console.error(text);
      console.error(err);
   }
}
function convert(resourcesRoot, filePattern, cb) {
   helpers.recurse(resourcesRoot, function(fullPath, callback) {
      // фильтр по файлам .html.tmpl
      if (!helpers.validateFile(fullPath, filePattern)) {
         return;
      }

      helpers.readFile(fullPath, function(err, html) {
         if (err) {
            errorTmplBuild(err, fullPath);
            return;
         }

         convertHtmlTmpl(html, fullPath, function(result) {
            var newFullPath = fullPath.replace(/\.tmpl$/, '');

            // если файл уже есть, удалим
            if (helpers.existsSync(newFullPath)) {
               helpers.unlinkSync(newFullPath);
            }

            // создадим файл с новым содержимым
            helpers.writeFile(newFullPath, result.toString(), callback);
         });
      });
   }, cb);
}

function convertHtmlTmpl(html, fullPath, callback) {
   if (html.indexOf('define') === 0) {
      warnTmplBuild(new Error(fullPath + ' - не шаблон!'), fullPath);
      return;
   }

   var conf = {config: config, filename: fullPath};
   var templateRender = Object.create(tmpl);
   try {
      // строю ast-дерево
      tmplLocalizator.parseTmpl(grunt, html, fullPath).addCallback(function(traversedObj) {
         const traversed = traversedObj.astResult;
         try {
            // строю функцию по ast-дереву
            var tmplFunc = templateRender.func(traversed, conf);

            // выполняю построенную функцию шаблона
            var resHtml = tmplFunc({}, {}, undefined, false, undefined, tclosure);

            callback(resHtml);
         } catch (err) {
            warnTmplBuild(err, fullPath);
         }
      }).addErrback(function(err) {
         warnTmplBuild(err, fullPath);
      });
   } catch (err) {
      errorTmplBuild(err, fullPath);
   }
}

module.exports = {
   convertHtmlTmpl: convertHtmlTmpl,
   convert: convert
};
