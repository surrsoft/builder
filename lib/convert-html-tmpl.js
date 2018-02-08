'use strict';

const tmplLocalizator = require('./i18n/tmpl-localizator'),
   tmpl = global.requirejs('View/Builder/Tmpl'),
   config = global.requirejs('View/config'),
   tclosure = global.requirejs('View/Runner/tclosure');

function convertHtmlTmpl(html, fullPath) {
   return new Promise(function(resolve, reject) {
      if (html.indexOf('define') === 0) {
         reject(new Error(`${fullPath} - не шаблон`));
         return;
      }

      const conf = {config: config, filename: fullPath};
      try {
         const templateRender = Object.create(tmpl),
            dependencies = [];

         templateRender.getComponents(html).forEach(function(dep) {
            dependencies.push(dep);
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
                        const result = tmplFunc({}, {}, undefined, false, undefined, tclosure);
                        if (typeof result === 'string') {
                           resolve(result);
                        } else {
                           //deferred
                           result.addCallback(function(res) {
                              resolve(res);
                           }).addErrback(function(err) {
                              reject(err);
                           });
                        }
                     },
                     function(err) {
                        reject(err);
                     });
               } catch (err) {
                  reject(err);
               }
            }, function(err) {
               reject(err);
            });
      } catch (err) {
         reject(err);
      }
   });
}

module.exports = convertHtmlTmpl;
