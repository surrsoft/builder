module.exports = function (app) {

   var cfg = {
      packwsmod: {},
      packjs: {},
      packcss: {}
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