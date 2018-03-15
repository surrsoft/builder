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
      less1by1: {},
      splitResources: {},
      deanonymize: {},
      xhtmlmin: {},
      routsearch: {},
      custompack: {},
      'ver-contents': {},
      convert: {},
      'html-tmpl': {},
      'static-html': {},
      tmplmin: {},
      prepackjs: {},
      gzip: {},
      'tmpl-build': {},
      'xhtml-build': {}
   };

   cfg.i18n.main = {
      root: root,
      application: application,
      cwd: target,
      dict: /\/lang\/..-..\/(..-..)\.json$/,
      css: /\/lang\/..-..\/(..-..)\.css$/,
      country: /\/lang\/..\/(..)\.css$/,
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
            from: /(url\(['"]?)([\w\/\.\-@{}]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg|\.css|\.woff|\.eot)/g,
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
            from: /((?:"|')(?:[a-z]+(?!:\/)|\/|\.\/|ws:\/)[\w\/+-.]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg)/g,
            to: '$1.v<%= grunt.option(\'versionize\') %>$2'
         }]
      },
      html: {
         src: [target + '**/*.html', target + '**/*.xhtml', target + '**/*.tmpl'],
         overwrite: true,
         replacements: [{
            from: /((?:"|')(?:[a-z]+(?!:\/)|\/|\.\/|%[^}]+}|{{[^}}]+}})[\w\/+-.]+(?:\.\d+)?)(\.svg|\.css|\.gif|\.png|\.jpg|\.jpeg)/ig,
            to: function(matchedWord, index, fullText, regexMatches) {
               if (matchedWord.indexOf('.v' + grunt.option('versionize')) > -1) {
                  return matchedWord;
               }
               return regexMatches[0] + '.v' + grunt.option('versionize') + regexMatches[1];
            }
         }, {
            from: /([\w]+[\s]*=[\s]*)((?:"|')(?:[a-z]+(?!:\/)|\/|(?:\.|\.\.)\/|%[^}]+})[\w\/+-.]+(?:\.\d+)?)(\.js)/ig,
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
      src: '*.html',
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
      src: '*.html',
      packages: 'resources/WI.SBIS/packer/js'
   };

   cfg.packcss.main = {
      root: root,
      application: application,
      src: '*.html',
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
         '!**/ws/ext/requirejs/**/*.js',

         /**
          * Плагины requirejs оставляем, они необходимы, чтобы в карте зависимостей они
          * правильно распознались как amd-модули и попадали в rtpackage без костылей
          */
         '**/ws/ext/requirejs/plugins/*.js'
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
         ],
         dest: target,
         ext: splittedCore ? '.min.css' : '.css'
      }]
   };

   cfg.less1by1.main = {
      root: root,
      application: application

   };

   cfg.splitResources.main = {
      root: root,
      application: application
   };

   cfg.deanonymize.main = {
      root: root,
      application: application,

      src: [
         '**/*.js',
         '!**/*.test.js',
         '!**/*.routes.js',
         '!**/*.worker.js',
         '!**/design/**/*.js',
         '!**/node_modules/**/*.js',
         '!./service/**/*.js',
         '!**/ws/ext/**/*.js'
      ]
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

   cfg.prepackjs.main = {
      src: [
         'resources/**/*.js',
         'ws/**/*.js'
      ]
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
