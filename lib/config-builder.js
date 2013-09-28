module.exports = function (app) {

   var cfg = {
      replace: {},
      packwsmod: {},
      packjs: {},
      packcss: {}
   };

   cfg.replace = {
      core: {
         src: ['**/ws/lib/core.js'],
         overwrite: true,
         replacements: [{
            from: /buildnumber:\s?[\'"]{2,2}/,
            to: 'buildnumber: "<%= grunt.option(\'version\') %>"'
         }]
      },
      css: {
         src: ['**/*.css'],
         overwrite: true,
         replacements: [{
            from: /(\.gif|\.png|\.jpg|\.css)/,
            to: '.v<%= grunt.option(\'version\') %>$1'
         }]
      },
      res: {
         src: ['**/*.xml', '**/*.js', '**/*.hdl'],
         overwrite: true,
         replacements: [{
            from: /(\.gif|\.png|\.jpg)/,
            to: '.v<%= grunt.option(\'version\') %>$1'
         }]
      },
      html: {
         src: ['**/*.html'],
         overwrite: true,
         replacements: [{
            from: /(\.css|\.js|\.gif|\.png|\.jpg)/,
            to: '.v<%= grunt.option(\'version\') %>$1'
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

   return cfg;
};