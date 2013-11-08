module.exports = function (app) {

   var cfg = {
      i18n: {},
      replace: {},
      packwsmod: {},
      packjs: {},
      packcss: {},
      'collect-dependencies': {}
   };

   cfg.i18n.main = {
      application: app || '',
      dict: ['**/resources/lang/*.json']
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
            from: /(\.gif|\.png|\.jpg)/g,
            to: '.v<%= grunt.option(\'versionize\') %>$1'
         }]
      },
      html: {
         src: ['**/*.html'],
         overwrite: true,
         replacements: [{
            from: /(\.css|\.js|\.gif|\.png|\.jpg)/g,
            to: '.v<%= grunt.option(\'versionize\') %>$1'
         }]
      }
   };

   cfg.packwsmod.main = {
      application: app || '.',
      modules: ['resources/**/*.module*.js', 'ws/**/*.module*.js'],
      htmls: '*.html',
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

   return cfg;
};