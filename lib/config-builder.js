module.exports = function (app) {

   var cfg = {
      packwsmod: {},
      packjs: {},
      packcss: {}
   };

   cfg.packwsmod.main = {
      application: app || '.',
      modules: ['resources/**/*.module.*.js', 'ws/**/*.module.*.js'],
      htmls: '*.html',
      packages: 'packer/modules'
   };

   cfg.packjs.main = {
      htmls: (app ? app + '/' : '') + '*.html',
      packages: (app ? app + '/' : '') + 'packer/js'
   };

   cfg.packcss.main = {
      htmls: (app ? app + '/' : '') + '*.html',
      packages: (app ? app + '/' : '') + 'packer/js'
   };

   return cfg;
};