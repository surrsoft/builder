/**
 * Набор функций для версионирования статического контента.
 * @author Колбешин Ф.А.
 */
'use strict';
const versionHeader = 'x_version=%{BUILDER_VERSION_STUB}';

function versionizeStyles(file) {
   const content = file.contents.toString();
   return content.replace(
      /(url\(['"]?)([\w/.\-@%{}]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg|\.css|\.woff2?|\.eot|\.ttf)(\?[\w#]+)?/g,
      (match, partUrl, partFilePath, partExt, extraData) => {
         // ignore cdn
         if (partFilePath.indexOf('cdn/') > -1) {
            return match;
         }
         if (partFilePath.indexOf('%{CDN_ROOT}') > -1) {
            file.cdnLinked = true;
            return match;
         }
         file.versioned = true;
         let result = `${partUrl}${partFilePath}${partExt}`;
         if (extraData) {
            const remainingHeaders = extraData.slice(1, extraData.length);
            result += `?${versionHeader}`;
            result += `${remainingHeaders.startsWith('#') ? '' : '#'}${remainingHeaders}`;
         } else {
            result += `?${versionHeader}`;
         }
         return result;
      }
   );
}

function versionizeTemplates(file) {
   const content = file.contents.toString();
   return content
      .replace(
         /((?:"|')(?:[A-z]+(?!:\/)|\/|\.\/|%[^}]+}|{{[^{}]+}})[\w{}/+-.]*(?:\.\d+)?(?:{{[^{}]+}})?)(\.svg|\.css|\.gif|\.png|\.jpg|\.jpeg|\.woff2?|\.eot|\.ttf|\.ico)(\?|"|')/gi,
         (match, partFilePath, partExt, remainingPart) => {
            // ignore cdn
            if (partFilePath.indexOf('cdn/') > -1) {
               return match;
            }
            if (partFilePath.indexOf('%{CDN_ROOT}') > -1) {
               file.cdnLinked = true;
               return match;
            }
            file.versioned = true;
            if (partExt === '.css') {
               // если в пути уже есть .min, то дублировать не нужно
               const partFilePathWithoutMin = partFilePath.replace(/\.min$/, '');
               return `${partFilePathWithoutMin}.min${partExt}?${versionHeader}${remainingPart}`;
            }
            return `${partFilePath}${partExt}?${versionHeader}${remainingPart}`;
         }
      )
      .replace(
         /([\w]+[\s]*=[\s]*)((?:"|')(?:[A-z]+(?!:\/)|\/|(?:\.|\.\.)\/|%[^}]+}|{{[^{}]*}})[\w/+-.]+(?:\.\d+)?)(\.js)/gi,
         (match, partEqual, partFilePath, partExt) => {
            // ignore cdn and data-providers
            if (partFilePath.indexOf('%{CDN_ROOT}') > -1) {
               file.cdnLinked = true;
               return match;
            }
            if (
               partFilePath.indexOf('cdn/') > -1 ||
               partFilePath.indexOf('//') === 1 ||
               !/^src|^href/i.test(match) ||
               partFilePath.indexOf('?x_version=') > -1
            ) {
               return match;
            }
            file.versioned = true;

            // если в пути уже есть .min, то дублировать не нужно
            const partFilePathWithoutMin = partFilePath.replace(/\.min$/, '');
            return `${partEqual}${partFilePathWithoutMin}.min${partExt}?${versionHeader}`;
         }
      );
}

module.exports = {
   versionizeStyles,
   versionizeTemplates
};
