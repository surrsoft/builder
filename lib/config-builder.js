module.exports = function (app) {

   var cfg = {
      i18n: {},
      packwsmod: {},
      packjs: {},
      packcss: {}
   };

   cfg.i18n.main = {
      dict: ['**/lang/*.json']
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