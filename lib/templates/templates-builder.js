/**
 * Class with main functions and parameters for platform templates
 * constructor to generate .html.tmpl/.wml/.tmpl files.
 * @author Kolbeshin F.A.
 */

'use strict';

const logger = require('../logger').logger();

class TemplatesBuilder {
   constructor() {
      // common template's constructor functions. Null by default
      this.tmplControlsApplicationRoute = null;
      this.ViewBuilderTmpl = null;
      this.ViewConfig = null;

      // common wsConfig params. Null by default.
      this.AppRoot = null;
      this.WsRoot = null;
      this.ResourceRoot = null;
      this.RUMEnabled = null;
      this.PageName = null;
      this.ServicesPath = null;
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

   // requires controls basic platform needed by html-tmpl compiler
   requireControls() {
      /**
       * Sometimes Controls/Application/Core don't even starts to build inside of Route,
       * besides there is no logs about happened, apparently this can means they were
       * stayed with require.js timeouts
       */
      const coreApp = global.requirejs('Controls/Application/Core');
      if (!coreApp) {
         logger.error({
            message: 'html.tmpl init error. Error requiring module "Controls/Application/Core"'
         });
      }

      global.requirejs('Controls/Application');
      this.tmplControlsApplicationRoute = global.requirejs('wml!Controls/Application/Route');
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
