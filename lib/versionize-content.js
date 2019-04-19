/**
 * Набор функций для версионирования статического контента.
 * @author Колбешин Ф.А.
 */
'use strict';
const versionHeader = 'x_version=%{MODULE_VERSION_STUB=%{modulePlaceholder}}';
const path = require('path');
const helpers = require('./helpers');

/**
 * placeholders examples:
 * 1) %{RESOURCE_ROOT}, %{WI.SBIS_ROOT} - from html.tmpl and templates for routing
 * 2) {{_options.resourceRoot}}, {{resourceRoot}} - from tmpl, xhtml.
 */
const templatePlaceholders = /^(\/?%?{?{[\w. ]+}}?\/?)/;

/**
 * get correct module name for template's url
 * @param linkPath - current link
 * @returns {string|*}
 */
function getTemplateLinkModuleName(linkPath) {
   let normalizedLink = helpers.removeLeadingSlash(linkPath);

   // for wsRoot and WI.SBIS_ROOT placeholders we should set moduleName as 'WS.Core'
   if (normalizedLink.includes('wsRoot') || normalizedLink.includes('WI.SBIS_ROOT')) {
      return 'WS.Core';
   }
   if (normalizedLink.startsWith('resources/')) {
      return normalizedLink.split('/')[1];
   }
   if (templatePlaceholders.test(normalizedLink)) {
      normalizedLink = normalizedLink.replace(templatePlaceholders, '');
   }
   const linkParts = normalizedLink.split('/');
   return linkParts.length > 1 ? linkParts.shift() : '';
}

/**
 * get correct module name for style's links
 * @param prettyFilePath - current file path
 * @param linkPath - current link
 * @param fileBase - current file module path
 * @returns {*}
 */
function getStyleLinkModuleName(prettyFilePath, linkPath, fileBase) {
   const moduleName = path.basename(fileBase);
   const root = path.dirname(fileBase);
   if (linkPath.startsWith('../') || linkPath.startsWith('./')) {
      const resolvedPath = helpers.unixifyPath(
         path.resolve(
            path.dirname(prettyFilePath),
            linkPath
         )
      );
      const pathWithoutRoot = helpers.removeLeadingSlash(resolvedPath.replace(root, ''));
      return pathWithoutRoot.split('/').shift();
   }
   return moduleName;
}

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
         const versionModuleName = getStyleLinkModuleName(
            helpers.unixifyPath(file.path),
            helpers.unixifyPath(partFilePath),
            helpers.unixifyPath(file.base)
         );

         const currentVersionHeader = versionHeader.replace('%{modulePlaceholder}', versionModuleName);
         let result = `${partUrl}${partFilePath}${partExt}`;
         if (extraData) {
            const remainingHeaders = extraData.slice(1, extraData.length);
            result += `?${currentVersionHeader}`;
            result += `${remainingHeaders.startsWith('#') ? '' : '#'}${remainingHeaders}`;
         } else {
            result += `?${currentVersionHeader}`;
         }
         return result;
      }
   );
}

function versionizeTemplates(file, moduleInfo) {
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
            let versionModuleName = getTemplateLinkModuleName(partFilePath.replace(/^"/, ''));
            if (!versionModuleName) {
               versionModuleName = path.basename(moduleInfo.output);
            }
            const currentVersionHeader = versionHeader.replace('%{modulePlaceholder}', versionModuleName);
            file.versioned = true;
            if (partExt === '.css') {
               // если в пути уже есть .min, то дублировать не нужно
               const partFilePathWithoutMin = partFilePath.replace(/\.min$/, '');
               return `${partFilePathWithoutMin}.min${partExt}?${currentVersionHeader}${remainingPart}`;
            }
            return `${partFilePath}${partExt}?${currentVersionHeader}${remainingPart}`;
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
            let versionModuleName = getTemplateLinkModuleName(partFilePath.replace(/^"/, ''));
            if (!versionModuleName) {
               versionModuleName = path.basename(moduleInfo.output);
            }
            const currentVersionHeader = versionHeader.replace('%{modulePlaceholder}', versionModuleName);

            // если в пути уже есть .min, то дублировать не нужно
            const partFilePathWithoutMin = partFilePath.replace(/\.min$/, '');
            return `${partEqual}${partFilePathWithoutMin}.min${partExt}?${currentVersionHeader}`;
         }
      );
}

module.exports = {
   versionizeStyles,
   versionizeTemplates
};
