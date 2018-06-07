'use strict';

const path = require('path');

module.exports = function(grunt, root, application) {
   const target = path.join(root, application);
   const splittedCore = grunt.option('splitted-core');

   const cfg = {
      i18n: {},
      replace: {},
      packwsmod: {},
      owndepspack: {},
      packjs: {},
      packcss: {},
      'collect-dependencies': {},
      uglify: {},
      cssmin: {},
      splitResources: {},
      xhtmlmin: {},
      routsearch: {},
      custompack: {},
      'ver-contents': {},
      convert: {},
      'html-tmpl': {},
      'static-html': {},
      tmplmin: {},
      gzip: {},
      'tmpl-build': {},
      'xhtml-build': {},
      'correct-exit-code': {}
   };

   cfg.i18n.main = {
      root: root,
      application: application,
      cwd: target,
      packages: 'resources/WI.SBIS/packer/i18n'
   };

   cfg.replace = {
      core: {
         src: [target + '**/ws/ext/requirejs/config.js', target + '**/ws/core/constants.js'],
         overwrite: true,
         replacements: [{
            from: /buildnumber:\s?['"]{2}/g,
            to: 'buildnumber: "<%= grunt.option(\'versionize\') %>"'
         }]
      },
      css: {
         src: [target + '**/*.css', target + '**/*.less'],
         overwrite: true,
         replacements: [{
            from: /(url\(['"]?)([\w\/\.\-@{}]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg|\.css|\.woff|\.eot|\.ttf)/g,
            to: function(matchedWord, index, fullText, regexMatches) {
               // ignore cdn and data-providers
               if (regexMatches[1].indexOf('cdn/') > -1) {
                  return matchedWord;
               }
               return regexMatches[0] + regexMatches[1] + '.v' + grunt.option('versionize') + regexMatches[2];
            }
         }]
      },
      res: {
         src: [target + '**/*.xml', target + '**/*.js', target + '**/*.hdl'],
         overwrite: true,
         replacements: [{
            from: /((?:"|')(?:[A-z]+(?!:\/)|\/|\.\/|ws:\/)[\w\/+-.]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg)/g,
            to: '$1.v<%= grunt.option(\'versionize\') %>$2'
         }]
      },
      html: {
         src: [target + '**/*.html', target + '**/*.xhtml', target + '**/*.tmpl'],
         overwrite: true,
         replacements: [{
            from: /((?:"|')(?:[A-z]+(?!:\/)|\/|\.\/|%[^}]+}|{{[^}}]+}})[\w\/+-.]+(?:\.\d+)?)(\.svg|\.css|\.gif|\.png|\.jpg|\.jpeg)/ig,
            to: function(matchedWord, index, fullText, regexMatches) {
               if (matchedWord.indexOf('.v' + grunt.option('versionize')) > -1) {
                  return matchedWord;
               }
               return regexMatches[0] + '.v' + grunt.option('versionize') + regexMatches[1];
            }
         }, {
            from: /([\w]+[\s]*=[\s]*)((?:"|')(?:[A-z]+(?!:\/)|\/|(?:\.|\.\.)\/|%[^}]+})[\w\/+-.]+(?:\.\d+)?)(\.js)/ig,
            to: function(matchedWord, index, fullText, regexMatches) {
               // ignore cdn and data-providers
               if (regexMatches[1].indexOf('cdn/') > -1 ||
                  regexMatches[1].indexOf('//') === 1 ||
                  !/^src|^href/i.test(matchedWord) ||
                  regexMatches[1].indexOf('.v' + grunt.option('versionize')) > -1
               ) {
                  return matchedWord;
               }
               return regexMatches[0] + regexMatches[1] + '.v' + grunt.option('versionize') + regexMatches[2];
            }
         }]
      }
   };

   cfg.packwsmod.main = {
      root: root,
      application: application,
      src: splittedCore ? [
         'resources/*/*.html',
         '!resources/*/ver.html'
      ] : '*.html',
      packages: 'resources/WI.SBIS/packer/modules'
   };

   cfg.owndepspack.main = {
      root: root,
      application: application,
      splittedCore: splittedCore
   };

   cfg.packjs.main = {
      root: root,
      application: application,
      src: splittedCore ? [
         'resources/*/*.html',
         '!resources/*/ver.html'
      ] : '*.html',
      packages: 'resources/WI.SBIS/packer/js'
   };

   cfg.packcss.main = {
      root: root,
      application: application,
      src: splittedCore ? [
         'resources/*/*.html',
         '!resources/*/ver.html'
      ] : '*.html',
      packages: 'resources/WI.SBIS/packer/css'
   };

   cfg['collect-dependencies'].main = {
      root: root,
      application: application,
      src: [
         'resources/**/*.js',
         'ws/**/*.js',
         '!**/*.test.js',
         '!**/*.routes.js',
         '!**/*.worker.js',
         '!**/design/**/*.js',
         '!**/node_modules/**/*.js',
         '!./service/**/*.js',
         '!**/WS.Core/ext/requirejs/**/*.js',
         '!**/ws/ext/requirejs/**/*.js',

         /**
          * исключаем ace библиотеку из таски из за весьма странных зависимостей(мягко говоря)
          */
         '!**/third-party/ace-builds/**/*.js',

         /**
          * Плагины requirejs оставляем, они необходимы, чтобы в карте зависимостей они
          * правильно распознались как amd-модули и попадали в rtpackage без костылей
          */
         splittedCore ? '**/WS.Core/ext/requirejs/plugins/*.js' : '**/ws/ext/requirejs/plugins/*.js'
      ]
   };

   cfg.uglify.main = {
      root: root,
      application: application,
      splittedCore: splittedCore,
      files: [{
         expand: true,
         cwd: target,
         src: [
            splittedCore ? '**/*.min.tmpl' : '**/*.tmpl',
            splittedCore ? '**/*.min.xhtml' : '**/*.xhtml',
            '**/*.js',
            '**/*.hdl',
            splittedCore ? '**/*.jstpl' : '!**/*.jstpl',
            splittedCore ? '**/*.json' : '!**/*.json',
            '!**/*.min.js',
            '!**/*.routes.js',
            '!**/ServerEvent/worker/*.js',
            '!**/*.test.js',
            '!**/design/**/*.js',
            '!**/data-providers/*.js',
            '!**/node_modules/**/*.js',
            '!**/inside.tensor.js',
            '!**/online.sbis.js',
            '!./service/**/*.js',
            '!**/WI.SBIS/packer/**/*.js',
            '!**/*.package.json',
            '!**/EDO2/Route/**/*.js' //https://online.sbis.ru/opendoc.html?guid=761eb095-c7be-437d-ab0c-c5058de852a4
         ],
         dest: target
      }]
   };

   cfg.cssmin.main = {
      root: root,
      application: application,
      splittedCore: splittedCore,
      options: {
         advanced: false,
         aggressiveMerging: false,
         compatibility: 'ie8',
         inliner: false,
         keepBreaks: false,
         keepSpecialComments: '*',
         mediaMerging: false,
         processImport: false,
         rebase: false,
         restructuring: false,
         roundingPrecision: 2
      },
      files: [{
         expand: true,
         cwd: target,
         src: [
            '**/*.css',
            '!**/*.min.css',
            '!**/design/**/*.css',
            '!**/node_modules/**/*.css',
            '!./service/**/*.css'
         ]
      }]
   };

   cfg['correct-exit-code'].main = {};

   cfg.splitResources.main = {
      root: root,
      application: application
   };

   cfg.xhtmlmin.main = {
      cwd: target,
      src: [
         '**/*.xhtml',
         '**/*.html',
         '!**/node_modules/**/*.html',
         '!**/service/**/*.html'
      ]
   };

   cfg.routsearch.main = {
      root: root,
      application: application,
      src: [
         'resources/**/*.routes.js',
         'ws/**/*.routes.js'
      ]
   };

   cfg['ver-contents'].main = {
      cwd: target,
      ver: grunt.option('versionize')
   };

   cfg.custompack.main = {
      root: root,
      application: application,
      splittedCore: splittedCore,
      src: ['**/*.package.json']
   };

   cfg.convert.main = {
      cwd: target
   };

   cfg['static-html'].main = {
      root: root,
      application: application,
      src: [
         'resources/**/*.js',
         '!resources/**/*.test.js',
         '!resources/**/*.routes.js',
         '!resources/**/*.worker.js',
         '!resources/**/design/**/*.js',
         '!resources/**/node_modules/**/*.js',
         '!resources/**/service/**/*.js'
      ],
      html: ['*.html']
   };
   cfg['html-tmpl'].main = {
      root: root,
      application: application,
      filePattern: ['**/*.html.tmpl']
   };

   cfg.tmplmin.main = {
      src: ['**/*.tmpl']
   };

   cfg.gzip.main = {
      root: root,
      application: application,
      src: [
         '**/*.js',
         '**/*.json',
         '**/*.css',
         '**/*.tmpl',
         '**/*.woff',
         '**/*.ttf',
         '**/*.eot',
         '!**/*.routes.js',
         '!**/*.original.js',
         '!**/*.modulepack.js',
         '!**/*.test.js',
         '!**/*.esp.json',
         '!**/design/**/*.js',
         '!**/data-providers/*.js',
         '!**/node_modules/**/*.js',
         '!./service/**/*.js'
      ]
   };

   cfg['tmpl-build'].main = {
      root: root,
      application: application,
      splittedCore: splittedCore,
      files: [{
         expand: true,
         cwd: target,
         src: [
            splittedCore ? 'resources/**/*.tmpl' : '**/*.tmpl'
         ],
         dest: target
      }]
   };
   cfg['xhtml-build'].main = {
      root: root,
      application: application,
      splittedCore: splittedCore,
      files: [{
         expand: true,
         cwd: target,
         src: [
            splittedCore ? 'resources/**/*.xhtml' : '**/*.xhtml'
         ],
         dest: target
      }]
   };

   return cfg;
};
