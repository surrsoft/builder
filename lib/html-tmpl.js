'use strict';

const tmplLocalizator = require('./i18n/tmplLocalizator'),
   tmpl = global.requirejs('View/Builder/Tmpl'),
   config = global.requirejs('View/config'),
   tclosure = global.requirejs('View/Runner/tclosure'),
   logger = require('./logger').logger;

function warnTmplBuild(err, fullPath) {
   logger.warning(`Resources error. An ERROR occurred while building template! ${err.message}, in file: ${fullPath}`);

}

function errorTmplBuild(err, fullPath) {
   logger.error(`Resources error. An ERROR occurred while building template! File path: ${fullPath}`);
}

function convertHtmlTmpl(html, fullPath, callback) {
   if (html.indexOf('define') === 0) {
      warnTmplBuild(new Error(fullPath + ' - не шаблон!'), fullPath);
      return;
   }

   const conf = {config: config, filename: fullPath};
   const templateRender = Object.create(tmpl);
   try {
      // строю ast-дерево
      tmplLocalizator.parseTmpl(html, fullPath)
         .then(function(traversedObj) {
            const traversed = traversedObj.astResult;
            try {
               // строю функцию по ast-дереву
               const tmplFunc = templateRender.func(traversed, conf);

               // выполняю построенную функцию шаблона
               const resHtml = tmplFunc({}, {}, undefined, false, undefined, tclosure);

               callback(resHtml);
            } catch (err) {
               warnTmplBuild(err, fullPath);
            }
         }, function(err) {
            warnTmplBuild(err, fullPath);
         });
   } catch (err) {
      errorTmplBuild(err, fullPath);
   }
}

module.exports = {
   convertHtmlTmpl: convertHtmlTmpl,
};
