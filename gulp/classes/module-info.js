'use strict';

const transliterate = require('../../lib/transliterate'),
   path = require('path');

class ModuleInfo {
   constructor(moduleName, moduleResponsible, modulePath, commonOutputPath) {
      this.name = moduleName;
      this.responsible = moduleResponsible;
      this.path = modulePath;
      this.output = path.join(commonOutputPath, transliterate(path.basename(modulePath)));

      //объект для записи contents.json
      //availableLanguage, defaultLanguage и dictionary добавляются только при локализации
      this.contents = {
         'htmlNames': {},
         'jsModules': {},
         'modules': {},
         'requirejsPaths': {}, //TODO: Удалить
         'xmlContents': {} //TODO: Удалить
      };

      //объект для записи routes-info.json
      this.routesInfo = {};

      //объект для записи static_templates.json
      //соответствие запроса html физическиому расположению файла
      this.staticTemplates = {};
   }

   get nameWithResponsible() {
      if (this.responsible) {
         return `${this.name} (${this.responsible})`;
      }
      return this.name;
   }

   get folderName() {
      return path.basename(this.path);
   }

}

module.exports = ModuleInfo;
