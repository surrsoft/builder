'use strict';

const processingTmpl = require('./processing-tmpl'),
   tmpl = global.requirejs('View/Builder/Tmpl'),
   config = global.requirejs('View/config');

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
         processingTmpl.parseTmpl(html, fullPath, componentsProperties)
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
   generateFunction: generateFunction
};
