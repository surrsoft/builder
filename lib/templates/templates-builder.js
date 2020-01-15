/**
 * Class with main functions and parameters for platform templates
 * constructor to generate .html.tmpl/.wml/.tmpl files.
 * @author Kolbeshin F.A.
 */

'use strict';

/**
 * Рандомно генерируемые аттрибуты
 * Необходимо убирать из сгенерированного html для тестов дифф верстки
 * https://online.sbis.ru/opendoc.html?guid=2b25dbee-be00-4c07-b101-db3af72c80b0
 */
const TEST_ATTRS = ['config'];
class TemplatesBuilder {
   constructor() {
      // common template's constructor functions. Null by default
      this.tmplControlsApplicationRoute = null;
      this.ViewBuilderTmpl = null;
      this.ViewConfig = null;

      // common wsConfig params. Null by default.
      this.appRoot = null;
      this.wsRoot = null;
      this.resourceRoot = null;
      this.RUMEnabled = null;
      this.pageName = null;
      this.servicesPath = null;
   }

   // requires basic platform needed by .wml/.tmpl/.html.tmpl compiler.
   requireView() {
      if (!this.ViewBuilderTmpl) {
         this.ViewBuilderTmpl = global.requirejs('View/Builder/Tmpl');
      }
      if (!this.ViewConfig) {
         this.ViewConfig = global.requirejs('View/config');
      }
   }

   async render(_options) {
      const html = await new Promise((resolve, reject) => {
         global.requirejs(['UI/Base'], (base) => {
            const application = 'UI/_base/HTML';
            const route = base.BaseRoute;
            try {
               resolve(route({
                  servicesPath: this.servicesPath,
                  resourceRoot: this.resourceRoot,
                  RUMEnabled: this.RUMEnabled,
                  pageName: this.pageName,
                  appRoot: this.appRoot,
                  wsRoot: this.wsRoot,
                  application,
                  _options,
               }));
            } catch (e) {
               reject(e);
            }
         }, reject);
      });
      return removeHtmlAttrs(html, TEST_ATTRS);
   }

   setCommonRootInfo(serviceConfig) {
      /**
       * In case of presentation service usage in current project set wsConfig common parameters
       * with special placeholder to be replaced by PS afterwards. Otherwise default meta with
       * application(configured in builder by gulp_config - applicationForRebase) will be used
       */
      if (!this.appRoot) {
         const { servicesPath, application, multiService } = serviceConfig;
         this.appRoot = multiService ? '%{APPLICATION_ROOT}' : application;
         this.wsRoot = multiService ? '%{WI.SBIS_ROOT}' : `${application}resources/WS.Core/`;
         this.resourceRoot = multiService ? '%{RESOURCE_ROOT}' : `${application}resources/`;
         this.RUMEnabled = multiService ? '%{RUM_ENABLED}' : 'false';
         this.pageName = multiService ? '%{PAGE_NAME}' : '';
         this.servicesPath = multiService ? '%{SERVICES_PATH}' : servicesPath;
      }
   }
}

module.exports = TemplatesBuilder;

/**
 * Удаляет переданные аттрибуты из html
 * @param {string} html
 * @param {string[]} attrs
 */
function removeHtmlAttrs(html, attrs) {
   return attrs.reduce((prev, attr) => prev.replace(new RegExp(` ${attr}=["|'][^\\s+]+(\\s+[^\\s+])*["|']`, 'gi'), ''), html);
}
