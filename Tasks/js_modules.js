'use strict';

var path = require('path');
//var modRx = /define\(['"](js!)?([.\w/]+)['"],/;
var esprima = require('esprima');
var traverse = require('estraverse').traverse;

function parseModule(module) {
   var res;
   try {
      res = esprima.parse(module);
   } catch (e) {
      res = e;
   }
   return res;
}

module.exports = function (grunt) {
   grunt.registerMultiTask('jsModules', 'fill jsModules in contents.json ', function () {
      grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача сбора jsModules.');

      var
         root = grunt.option('root') || '',
         app = grunt.option('application') || '',
         service_mapping = grunt.option('service_mapping') || false,
         rootPath = path.join(root, app),
         resourcesPath = path.join(rootPath, 'resources'),
         sourceFiles = grunt.file.expand({cwd: resourcesPath}, this.data),
         contents = {},
         jsModules = {};


      sourceFiles.forEach(function (file) {
         var text = grunt.file.read(path.join(resourcesPath, file));
         var ast = parseModule(text);

         if (ast instanceof Error) {
            ast.message += '\nPath: ' + fullPath;
            return grunt.fail.fatal(ast);
         }

         traverse(ast, {
            enter: function getModuleName(node) {
               if (node.type == 'CallExpression' && node.callee.type == 'Identifier' &&
                  node.callee.name == 'define') {
                  if (node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
                     var moduleName = node.arguments[0].value;
                     var parts = moduleName.split('!');
                     if (parts[0] == 'js') {
                        jsModules[parts[1]] = '/' + file;
                     }
                  }
               }
            }
         });
      });

      try {
         contents = require(path.join(resourcesPath, 'contents.json'));
      } catch (err) {
         grunt.log.warn('Error while requiring contents.json', err);
      }

      try {
         contents.jsModules = jsModules;

         if (service_mapping) {
            var srv_arr = service_mapping.trim().split(' ');
            if (srv_arr.length % 2 == 0) {
               var services = {};
               for (var i = 0; i < srv_arr.length; i+=2) {
                  services[srv_arr[i]] = srv_arr[i + 1];
               }
               contents.services = services;
            } else {
               grunt.fail.fatal("Services list must be even!");
            }
         }

         grunt.file.write(path.join(resourcesPath, 'contents.json'), JSON.stringify(contents, null, 2));
         grunt.file.write(path.join(resourcesPath, 'contents.js'), 'contents='+JSON.stringify(contents));
      } catch (err) {
         grunt.fail.fatal(err);
      }
   });
};