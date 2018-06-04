'use strict';

const transliterate = require('../../../lib/transliterate'),
   path = require('path'),
   BaseModuleInfo = require('../../helpers/base-module-info');

class ModuleInfo extends BaseModuleInfo {
   constructor(moduleName, moduleResponsible, modulePath, commonOutputPath) {
      super(moduleName, moduleResponsible, modulePath);
      this.output = path.join(commonOutputPath, transliterate(path.basename(modulePath)));

      // объект для записи contents.json
      // availableLanguage, defaultLanguage и dictionary добавляются только при локализации
      this.contents = {
         htmlNames: {},
         modules: {},
         requirejsPaths: {},

         // TODO: Удалить jsModules, xmlContents
         jsModules: {},
         xmlContents: {}
      };

      // объект для записи routes-info.json
      this.routesInfo = {};

      // объект для записи static_templates.json
      // соответствие запроса html физическиому расположению файла
      this.staticTemplates = {};

      // объект для записи navigation-modules.json
      this.navigationModules = [];
   }
}

module.exports = ModuleInfo;
