/**
 * Набор функций для версионирования статического контента.
 * @author Колбешин Ф.А.
 */
'use strict';
const versionHeader = '?x_version=BUILDER_VERSION_STUB';

function versionizeStyles(content) {
   return content.replace(
      /(url\(['"]?)([\w/.\-@{}]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg|\.css|\.woff|\.eot|\.ttf)/g,
      (match, partUrl, partFilePath, partExt) => {
         if (partFilePath.indexOf('cdn/') > -1) {
            return match;
         }
         return `${partUrl}${partFilePath}${partExt}${versionHeader}`;
      }
   );
}

function versionizeJs(content) {
   return content.replace(
      /((?:"|')(?:[A-z]+(?!:\/)|\/|\.\/|ws:\/)[\w/+-.]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg)/g,
      `$1$2${versionHeader}`
   );
}

function versionizeTemplates(content) {
   return content
      .replace(
         /((?:"|')(?:[A-z]+(?!:\/)|\/|\.\/|%[^}]+}|{{[^{}]+}})[\w{}/+-.]*(?:\.\d+)?(?:{{[^{}]+}})?)(\.svg|\.css|\.gif|\.png|\.jpg|\.jpeg)/gi,
         (match, partFilePath, partExt) => {
            if (partExt === '.css') {
               // если в пути уже есть .min, то дублировать не нужно
               const partFilePathWithoutMin = partFilePath.replace(/\.min$/, '');
               return `${partFilePathWithoutMin}.min${partExt}${versionHeader}`;
            }
            return `${partFilePath}${partExt}${versionHeader}`;
         }
      )
      .replace(
         /([\w]+[\s]*=[\s]*)((?:"|')(?:[A-z]+(?!:\/)|\/|(?:\.|\.\.)\/|%[^}]+}|{{[^{}]*}})[\w/+-.]+(?:\.\d+)?)(\.js)/gi,
         (match, partEqual, partFilePath, partExt) => {
            // ignore cdn and data-providers
            if (
               partFilePath.indexOf('cdn/') > -1 ||
               partFilePath.indexOf('//') === 1 ||
               !/^src|^href/i.test(match) ||
               partFilePath.indexOf('?x_version=') > -1
            ) {
               return match;
            }

            // если в пути уже есть .min, то дублировать не нужно
            const partFilePathWithoutMin = partFilePath.replace(/\.min$/, '');
            return `${partEqual}${partFilePathWithoutMin}.min${partExt}${versionHeader}`;
         }
      );
}

module.exports = {
   versionizeStyles,
   versionizeJs,
   versionizeTemplates
};
