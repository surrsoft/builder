'use strict';

const helpers = require('../../lib/helpers'),
   path = require('path');

class DictionaryIndexer {
   constructor(localizations) {
      this.localizations = localizations;
      this.dictionaryForContents = {};
   }

   //Формирует ключ вида Папка.язык.расширение
   _getDirectoryKey(modulePath, lang, ext) {
      const moduleName = path.basename(modulePath);
      return moduleName + '.' + lang + '.' + ext;
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

   extractMergedCSSCode(modulePath, localization) {
      return '';
   }

   extractLoaderCode(modulePath, localization) {
      /*
      const dictModuleDeps = ['"Core/i18n"'],
         dictModuleArgs = ['i18n'];

      let dictModuleContent = '';

      if (dictExist) {
         const relativeDictPath = path.relative(resourceRoot, dictPath).replace(dblSlashes, '/');
         dictModuleDeps.push('"text!' + relativeDictPath.replace(isWS, 'WS') + '"');
         dictModuleArgs.push('dict');
         dictModuleContent += 'i18n.setDict(JSON.parse(dict), "text!' + relativeDictPath.replace(isWS, 'WS') + '", "' + langKey + '");';

         jsDict[getDirectoryKey(modulePath, langKey, 'json')] = true;
      }
      if (mergedCss) {
         const relativeCssPath = path.relative(resourceRoot, cssPath).replace(dblSlashes, '/').replace('.css', '');
         dictModuleContent += 'if(i18n.getLang()=="' + langKey + '"){global.requirejs(["native-css!' + relativeCssPath + '"]);}';
         fs.writeFileSync(cssPath, mergedCss);
         jsDict[getDirectoryKey(modulePath, langKey, 'css')] = true;
      }

      const fileContent = '(function() {' +
         'var global = (function(){ return this || (0,eval)("this"); }()),' +
         'define = global.define || (global.requirejs && global.requirejs.define) || (requirejsVars && requirejsVars.define);' +
         'global.requirejs(["Core/core-ready"],function(){' +
         'global.requirejs([' + dictModuleDeps.join() + '],function(' + dictModuleArgs.join() + '){' + dictModuleContent + '});});})();';
         */
   }

   getDictionaryForContents() {
      return this.dictionaryForContents;
   }
}

module.exports = DictionaryIndexer;
