/**
 * @author Бегунов Ал. В.
 */

'use strict';

const path = require('path');

/**
 * Класс с базовой информацией о модуле. Используется как база для сборки статики и для сбора фраз локализации.
 */
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
