'use strict';

const transliterate = require('../../lib/transliterate'),
   path = require('path');

class ModuleInfo {
   constructor(moduleName, moduleResponsible, modulePath, commonOutputPath) {
      this.name = moduleName;
      this.responsible = moduleResponsible;
      this.path = modulePath;
      this.output = path.join(commonOutputPath, transliterate(path.basename(modulePath)));
   }

   get nameWithResponsible() {
      if (this.responsible) {
         return `${this.name} (${this.responsible})`;
      }
      return this.name;
   }
}

module.exports = ModuleInfo;
