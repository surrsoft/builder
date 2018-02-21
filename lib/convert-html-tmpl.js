'use strict';

const tmplLocalizator = require('./i18n/tmpl-localizator'),
   tmpl = global.requirejs('View/Builder/Tmpl'),
   config = global.requirejs('View/config'),
   wsPathCalculator = require('../lib/ws-path-calculator'),
   tclosure = global.requirejs('View/Runner/tclosure');

function generateMarkup(html, fullPath, componentsProperties, splittedCore) {
   return new Promise(function(resolve, reject) {
      generateFunction(html, fullPath, componentsProperties).then(function(res) {
         const tmplFunc = res.tmplFunc,
            dependencies = res.dependencies;

         // выполняю построенную функцию шаблона
         global.requirejs(dependencies,
            function() {
               const result = tmplFunc({
                  wsRoot: wsPathCalculator.getWsRoot(splittedCore),
                  resourceRoot: wsPathCalculator.getResources(splittedCore),
               }, {}, undefined, false, undefined, tclosure);
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
      }, function(err) {
         reject(err);
      });
   });
}
function generateFunction(html, fullPath, componentsProperties) {
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
         tmplLocalizator.parseTmpl(html, fullPath, componentsProperties)
            .then(function(traversedObj) {
               const traversed = traversedObj.astResult;
               try {
                  // строю функцию по ast-дереву
                  const tmplFunc = templateRender.func(traversed, conf);
                  resolve({
                     dependencies: dependencies,
                     tmplFunc: tmplFunc
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

module.exports = {
   generateMarkup: generateMarkup,
   generateFunction: generateFunction
};
