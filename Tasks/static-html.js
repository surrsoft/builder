'use strict';

var path = require('path');
var fs = require('fs');
var esprima = require('esprima');
var traverse = require('estraverse').traverse;
var transliterate = require('./../lib/utils/transliterate');
var replaceIncludes = require('./../lib/utils/include-replacer');

var cache = {};

function parseModule(module) {
   var res;
   try {
      res = esprima.parse(module);
   } catch (e) {
      res = e;
   }
   return res;
}

function findExpression(node, left) {
   return node.type == 'ExpressionStatement' && node.expression.type == 'AssignmentExpression' &&
      node.expression.operator == '=' && node.expression.left.type == 'MemberExpression' &&
      node.expression.left.property.name == left && node.expression.left.object &&
      node.expression.left.object.type == 'Identifier';
}

function parseObjectExpression(properties) {
   var obj = {};
   properties.forEach(function (prop) {
      obj[prop.key.name] = prop.value.value;
   });
   return obj;
}

module.exports = function (grunt) {
   var root = grunt.option('root') || '';
   var app = grunt.option('application') || '/';
   var srvPath = grunt.option('services_path') || '';
   var userParams = grunt.option('user_params') || false;
   var globalParams = grunt.option('global_params') || false;
   var appRoot = path.join(root, app);

   var replaceOpts = {
      WINDOW_TITLE: '',
      APPEND_STYLE: '',
      APPEND_JAVASCRIPT: '',
      ACCESS_LIST: '',
      APPLICATION_ROOT: app,
      SBIS_ROOT: app + 'ws/',
      RESOURCE_ROOT: app + 'resources/',
      SERVICES_PATH: srvPath || app + 'service/sbis-rpc-service300.dll',
      USER_PARAMS: userParams,
      GLOBAL_PARAMS: globalParams,
      SAVE_LAST_STATE: false,
      ROOT: appRoot
   };

   function generateHTML(htmlTemplate, outFileName) {
      var templatePath = path.join(appRoot, 'resources', htmlTemplate);
      var text = cache[templatePath] || (cache[templatePath] = grunt.file.read(templatePath));
      text = replaceIncludes(text, replaceOpts);
      grunt.file.write(path.join(appRoot, outFileName), text);
   }

   function parseOpts(opts) {
      var
         webPage = opts.webPage || {},
         htmlTemplate = webPage.htmlTemplate,
         outFileName = webPage.outFileName;
      replaceOpts.WINDOW_TITLE = opts.title || '';

      if (!htmlTemplate || !outFileName) {
         return;
      } else if (!(htmlTemplate.indexOf('Тема Скрепка') > -1 || htmlTemplate.indexOf('Tema_Skrepka') > -1)) {
         grunt.log.warn('HTML Template is not from Tema_Skrepka(Тема Cкрепка)', htmlTemplate);
      }
      htmlTemplate = transliterate(htmlTemplate.replace(/\\/g, '/'));

      generateHTML(htmlTemplate, outFileName + '.html');
   }

   grunt.registerMultiTask('static-html', 'Generate static html from modules', function () {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача static-html.');
      var start = Date.now();
      var sourceFiles = grunt.file.expand({cwd: appRoot}, this.data);
      var oldHtml = grunt.file.expand({cwd: appRoot}, ['*.html']);

      if (oldHtml && oldHtml.length) {
         oldHtml.forEach(function (file) {
            var filePath = path.join(appRoot, file);
            try {
               fs.unlinkSync(path.join(appRoot, file));
            } catch (err) {
               console.log('Can\'t delete old html: ', filePath, err);
            }
         });
      }

      try {
         sourceFiles.forEach(function (file) {
            var text = grunt.file.read(path.join(appRoot, file));
            var ast = parseModule(text);

            if (ast instanceof Error) {
               ast.message += '\nPath: ' + fullPath;
               return grunt.fail.fatal(ast);
            }

            var arrExpr = [];
            var ReturnStatement = null;

            traverse(ast, {
               enter: function getModuleName(node) {
                  if (findExpression(node, 'webPage') && node.expression.right && node.expression.right.type == 'ObjectExpression') {
                     arrExpr.push(node.expression);
                  }

                  if (findExpression(node, 'title') && node.expression.right && node.expression.right.type == 'Literal') {
                     arrExpr.push(node.expression);
                  }

                  if (node.type == 'CallExpression' && node.callee.type == 'Identifier' &&
                     node.callee.name == 'define') {
                     var fnNode = null;
                     if (node.arguments[1] && node.arguments[1].type == 'FunctionExpression') {
                        fnNode = node.arguments[1].body;
                     } else if (node.arguments[2] && node.arguments[2].type == 'FunctionExpression') {
                        fnNode = node.arguments[2].body;
                     }
                     if (fnNode) {
                        if (fnNode.body && fnNode.body instanceof Array) {
                           fnNode.body.forEach(function (i) {
                              if (i.type == 'ReturnStatement') {
                                 ReturnStatement = i.argument;
                              }
                           });
                        }
                     }
                  }
               }
            });

            if (arrExpr.length && ReturnStatement) {
               var opts = {};
               arrExpr.forEach(function (expr) {
                  try {
                     expr.left.object.name == ReturnStatement.name ? opts[expr.left.property.name] =
                        expr.right.type == 'ObjectExpression' ? parseObjectExpression(expr.right.properties)
                           : expr.right.value : false;
                  } catch (err) {
                     grunt.log.error(err);
                  }
               });

               parseOpts(opts)
            }
         });
         console.log('Duration: ' + (Date.now() - start));
      } catch (err) {
         grunt.fail.fatal(err);
      }
   });
};