module.exports = function (app, ignoreWS) {

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
      imagemin: {}
   };

   cfg.i18n.main = {
      application: app || '',
      dict: /\/resources\/lang\/..-..\/(..-..)\.json$/,
      packages: (app ? app + '/' : '') + 'resources/packer/i18n'
   };

   cfg.replace = {
      core: {
         src: ['**/ws/lib/core.js'],
         overwrite: true,
         replacements: [{
            from: /buildnumber:\s?['"]{2,2}/g,
            to: 'buildnumber: "<%= grunt.option(\'versionize\') %>"'
         }]
      },
      css: {
         src: ['**/*.css'],
         overwrite: true,
         replacements: [{
            from: /(\.gif|\.png|\.jpg|\.css)/g,
            to: '.v<%= grunt.option(\'versionize\') %>$1'
         }]
      },
      res: {
         src: ['**/*.xml', '**/*.js', '**/*.hdl'],
         overwrite: true,
         replacements: [{
            from: /((?:"|')(?:[a-z]+(?!:\/)|\/|\.\/)\w+[\w\/]+)(\.gif|\.png|\.jpg)/g,
            to: '$1.v<%= grunt.option(\'versionize\') %>$2'
         }]
      },
      html: {
         src: ['**/*.html'],
         overwrite: true,
         replacements: [{
            from: /((?:"|')(?:[a-z]+(?!:\/)|\/|\.\/)\w+[\w\/]+(?:\.\d+)?)(\.css|\.js|\.gif|\.png|\.jpg)/ig,
            to: '$1.v<%= grunt.option(\'versionize\') %>$2'
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
      htmls: (app ? app + '/' : '') + '*.html',
      packages: (app ? app + '/' : '') + 'resources/packer/js'
   };

   cfg.packcss.main = {
      htmls: (app ? app + '/' : '') + '*.html',
      packages: (app ? app + '/' : '') + 'resources/packer/css'
   };

   cfg['collect-dependencies'].main = {
      application: app || '.',
      modules: ['resources/**/*.module*.js', 'ws/**/*.module*.js']
   };

   cfg.uglify.main = {
      options: {
         preserveComments: 'some', // Оставим комментарии с лицениями
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
         src: ['**/*.js', '**/*.hdl', '!**/*.min.js', '!**/tinymce/**/*.js'].concat(ignoreWS ? ['!ws/**/*.js', '!ws/**/*.hdl'] : []),
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
         src: ['**/*.css', '!**/*.min.css'].concat(ignoreWS ? ['!ws/**/*.css'] : []),
         dest: app || '.'
      }]
   };

   return cfg;
};