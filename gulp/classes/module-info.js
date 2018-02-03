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
         'requirejsPaths': {}
      };
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
