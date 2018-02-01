'use strict';

const fs             = require('fs');
const esprima        = require('esprima');
const estraverse     = require('estraverse');

module.exports = function(module, base) {
   let res;
   try {
      res = fs.readFileSync(module.fullPath);
   } catch (err) {
      console.error(err);
   }
   let amd         = module.amd;
   let anonymous   = false;
   return new Promise((resolve, reject) => {
      if (amd) {
         return resolve(res);
      } else {
         let ast;

         try {
            ast = esprima.parse(res + '');
         } catch (err) {
            console.error(err);
            return resolve();
         }

         estraverse.traverse(ast, {
            enter: function(node) {
               if (node.type == 'CallExpression' && node.callee.type == 'Identifier' && node.callee.name == 'define') {
                  if (node.arguments.length < 3) {
                     if (node.arguments.length == 2 &&
                                node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
                        // define('somestring', /* whatever */);
                     } else {
                        anonymous = true;
                     }
                  }
                  if (node.arguments[0] &&
                            node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string' &&
                            node.arguments[0].value == module.fullName) {
                     amd = true;
                  }
               }
            }
         });

         if (anonymous) {
            return resolve('');
         } else {
            return resolve(amd ? res : 'define("' + module.fullName + '", ""); ' + res);
         }
      }
   });
};
