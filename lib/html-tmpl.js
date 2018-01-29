'use strict';

const tmplLocalizator = require('./i18n/tmplLocalizator'),
   tmpl = global.requirejs('View/Builder/Tmpl'),
   config = global.requirejs('View/config'),
   tclosure = global.requirejs('View/Runner/tclosure');

function convertHtmlTmpl(html, fullPath, callback) {
   if (html.indexOf('define') === 0) {
      callback(new Error(`${fullPath} - не шаблон`));
      return;
   }

   const conf = {config: config, filename: fullPath};
   try {
      const templateRender = Object.create(tmpl),
         dependencies = [];

      templateRender.getComponents(html).forEach(function(dep) {
         //dependencies.push(dep);
      });

      // строю ast-дерево
      tmplLocalizator.parseTmpl(html, fullPath)
         .then(function(traversedObj) {
            const traversed = traversedObj.astResult;
            try {
               // строю функцию по ast-дереву
               const tmplFunc = templateRender.func(traversed, conf);

               // выполняю построенную функцию шаблона
               global.requirejs(dependencies,
                  function() {
                     const resHtml = tmplFunc({}, {}, undefined, false, undefined, tclosure);
                     callback(null, resHtml);
                  },
                  function(err) {
                     callback(err);
                  });
            } catch (err) {
               callback(err);
            }
         }, function(err) {
            callback(err);
         });
   } catch (err) {
      callback(err);
   }
}

module.exports = {
   convertHtmlTmpl: convertHtmlTmpl,
};
