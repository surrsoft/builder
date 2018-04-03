'use strict';

const helpers = require('../../lib/helpers'),
   path = require('path');

class DictionaryIndexer {
   constructor(localizations) {
      this.localizations = localizations;
      this.dictionaryForContents = {};
   }

   //Формирует ключ вида Папка.язык.расширение
   _getDirectoryKey(modulePath, locale, ext) {
      const moduleName = path.basename(modulePath);
      return moduleName + '.' + locale + '.' + ext;
   }

   addLocalizationJson(modulePath, filePath, locale) {
      if (this.localizations.includes(locale)) {
         const expectedFilePath = path.join(modulePath, 'lang', locale, locale + '.json');
         if (helpers.prettifyPath(filePath) === helpers.prettifyPath(expectedFilePath)) {
            this.dictionaryForContents[this._getDirectoryKey(modulePath, locale, 'json')] = true;
         }
      }
   }

   addLocalizationCSS(modulePath, filePath, locale, text) {
      return '';
   }

   extractMergedCSSCode(modulePath, locale) {
      return '';
   }

   extractLoaderCode(modulePath, locale) {
      const hasDict = this.dictionaryForContents.hasOwnProperty(this._getDirectoryKey(modulePath, locale, 'json'));
      const hasCss = this.dictionaryForContents.hasOwnProperty(this._getDirectoryKey(modulePath, locale, 'css'));
      if (!hasDict && !hasCss) {
         return '';
      }

      const dictModuleDeps = ['"Core/i18n"'],
         dictModuleArgs = ['i18n'];

      let dictModuleContent = '';
      const moduleName = path.basename(modulePath);

      if (hasDict) {
         const relativeDictPath = helpers.prettifyPath(path.join(moduleName, 'lang', locale, locale + '.json'));
         dictModuleDeps.push('"text!' + relativeDictPath + '"');
         dictModuleArgs.push('dict');
         dictModuleContent += 'i18n.setDict(JSON.parse(dict), "text!' + relativeDictPath + '", "' + locale + '");';
      }
      if (hasCss) {
         const relativeCssPath = helpers.prettifyPath(path.join(moduleName, 'lang', locale, locale));
         dictModuleContent += `if(i18n.getLang()=="${locale}"){global.requirejs(["native-css!${relativeCssPath}"]);}`;
      }

      return '(function() {' +
         'var global = (function(){ return this || (0,eval)("this"); }()),' +
         'define = global.define || (global.requirejs && global.requirejs.define) || (requirejsVars && requirejsVars.define);' +
         'global.requirejs(["Core/core-ready"],function(){' +
         `global.requirejs([${dictModuleDeps.join()}],function(${dictModuleArgs.join()}){${dictModuleContent}});});})();`;
   }

   getDictionaryForContents() {
      return this.dictionaryForContents;
   }
}

module.exports = DictionaryIndexer;
