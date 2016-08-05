module.exports = function (grunt, app) {

   var appRoot = app && app != '/' ? app + '/' : '';

   var cfg = {
      i18n: {},
      replace: {},
      packwsmod: {},
      owndepspack: {},
      packjs: {},
      packcss: {},
      'collect-dependencies': {},
      uglify: {},
      cssmin: {},
      imagemin: {},
      deanonymize: {},
      xhtmlmin: {},
      routsearch: {},
      'pack-contents': {},
      cleanempty: {},
      custompack: {},
      'ver-contents': {},
      jsModules: {},
      convert: {},
      requirejsPaths: {},
      'static-html': {}
   };

   cfg.i18n.main = {
      application: app || '.',
      dict: /\/resources\/lang\/..-..\/(..-..)\.json$/,
      packages: appRoot + 'resources/packer/i18n'
   };

   cfg.replace = {
      core: {
         src: [appRoot + '**/ws/lib/core.js', appRoot + '**/ws/ext/requirejs/config.js', appRoot + '**/ws/core/constants.js'],
         overwrite: true,
         replacements: [{
            from: /buildnumber:\s?['"]{2,2}/g,
            to: 'buildnumber: "<%= grunt.option(\'versionize\') %>"'
         }]
      },
      css: {
         src: [appRoot + '**/*.css'],
         overwrite: true,
         replacements: [{
            from: /(\.gif|\.png|\.jpg|\.css|\.woff|\.eot)/g,
            to: '.v<%= grunt.option(\'versionize\') %>$1'
         }]
      },
      res: {
         src: [appRoot + '**/*.xml', appRoot + '**/*.js', appRoot + '**/*.hdl'],
         overwrite: true,
         replacements: [{
            from: /((?:"|')(?:[a-z]+(?!:\/)|\/|\.\/|ws:\/)[\w\/+-\.]+)(\.gif|\.png|\.jpg)/g,
            to: '$1.v<%= grunt.option(\'versionize\') %>$2'
         }]
      },
      html: {
         src: [appRoot + '**/*.html'],
         overwrite: true,
         replacements: [{
            from: /((?:"|')(?:[a-z]+(?!:\/)|\/|\.\/)[\w\/+-\.]+(?:\.\d+)?)(\.css|\.gif|\.png|\.jpg)/ig,
            to: '$1.v<%= grunt.option(\'versionize\') %>$2'
         }, {
            from: /([\w]+[\s]*=[\s]*)((?:"|')(?:[a-z]+(?!:\/)|\/|\.\/|%{\w+})[\w\/+-\.]+(?:\.\d+)?)(\.js)/ig,
            to: function (matchedWord, index, fullText, regexMatches) {
               // ignore cdn and data-providers
               if (regexMatches[1].indexOf('cdn/') > -1 || !/^src|^href/i.test(matchedWord)) {
                  return matchedWord;
               }
               return regexMatches[0] + regexMatches[1] + '.v' + grunt.option('versionize') + regexMatches[2];
            }
         }]
      },
      i18n: {
         src: [appRoot + '**/ws/lib/core.js', appRoot + '**/ws/core/constants.js'],
         overwrite: true,
         replacements: [{
            from: /i18n:\s?false/g,
            to: 'i18n: true'
         }]
      }
   };

   cfg.packwsmod.main = {
      application: app || '.',
      modules: ['resources/**/*.module*.js', 'ws/**/*.module*.js'],
      htmls: '*.html',
      packages: 'resources/packer/modules'
   };

   cfg.owndepspack.main = {
      application: app || '.',
      packages: 'resources/packer/modules'
   };

   cfg.packjs.main = {
      htmls: appRoot + '*.html',
      packages: appRoot + 'resources/packer/js'
   };

   cfg.packcss.main = {
      htmls: appRoot + '*.html',
      packages: appRoot + 'resources/packer/css'
   };

   cfg['collect-dependencies'].main = {
      application: app || '.',
      src: [
         '**/*.js',
         '!**/*.test.js',
         '!**/design/**/*.js',
         '!**/node_modules/**/*.js',
         '!**/service/**/*.js'
      ]
   };

   cfg.uglify.main = {
      options: {
         preserveComments: false, // Оставим комментарии с лицениями
         mangle: {
            except: ['define']
         },
         compress: {
            sequences: true,
            properties: false,
            dead_code: true,
            drop_debugger: true,
            conditionals: false,
            comparisons: false,
            evaluate: false,
            booleans: false,
            loops: false,
            unused: false,
            hoist_funs: false,
            if_return: false,
            join_vars: true,
            cascade: false,
            warnings: true,
            negate_iife: false,
            keep_fargs: true
         }
      },
      files: [{
         expand: true,
         cwd: app || '.',
         src: [
            '**/*.js',
            '**/*.hdl',
            '!**/*.min.js',
            '!**/*.routes.js',
            '!**/*.test.js',
            '!**/design/**/*.js',
            '!**/data-providers/*.js',
            '!**/node_modules/**/*.js',
            '!**/inside.tensor.js',
            '!**/online.sbis.js',
            '!**/service/**/*.js'
         ],
         dest: app || '.'
      }]
   };

   cfg.cssmin.main = {
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
         cwd: app || '.',
         src: [
            '**/*.css',
            '!**/*.min.css',
            '!**/design/**/*.css',
            '!**/node_modules/**/*.css',
            '!**/service/**/*.css'
         ],
         dest: app || '.'
      }]
   };

   cfg.deanonymize.main = {
      application: app || '.',
      src: [
         '**/*.js',
         '!**/*.test.js',
         '!**/design/**/*.js',
         '!**/node_modules/**/*.js',
         '!**/service/**/*.js'
      ]
   };

   cfg.xhtmlmin = {
      files: [
         '**/*.xhtml',
         '**/*.html',
         '!**/node_modules/**/*.html',
         '!**/service/**/*.html'
      ]
   };

   cfg.routsearch = {
      files: ['**/*.routes.js']
   };

   cfg['pack-contents'].main = {
      application: app || '.',
      resources: 'resources/'
   };

   cfg['ver-contents'].main = {
   };

   cfg.custompack.main = {
      application: app || '.',
      src: ['**/*.package.json']
   };

   cfg.jsModules = {
      files: ['**/*.module.js']
   };

   cfg.convert = {
      files: ['**/*']
   };

   cfg.requirejsPaths.main = {
      application: app || '.'
   };

   cfg['static-html'] = {
      files: ['resources/**/*.module.js']
   };

   return cfg;
};