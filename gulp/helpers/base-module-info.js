/**
 * @author Бегунов Ал. В.
 */

'use strict';

const path = require('path');

class ModuleInfo {
   constructor(moduleName, moduleResponsible, modulePath) {
      this.name = moduleName;
      this.responsible = moduleResponsible;
      this.path = modulePath;
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
