'use strict';

const path = require('path');
const postcss = require('postcss');
const postcssUrl = require('postcss-url');
const safe = require('postcss-safe-parser');
const logger = require('../../lib/logger').logger();
const helpers = require('../../lib/helpers');
const invalidUrl = /^(\/|#|data:|[a-z]+:\/\/)(?=.*)/i;
const importCss = /@import[^;]+;/gi;

function rebaseUrlsToAbsolutePath(root, sourceFile, css, resourceRoot) {
   let result;
   const resourceRootWithSlash = resourceRoot ? path.join('/', resourceRoot) : '/';
   try {
      result = postcss()
         .use(
            postcssUrl({
               url(asset, dir) {
                  // ignore absolute urls, hashes or data uris
                  if (invalidUrl.test(asset.url)) {
                     return asset.url;
                  }
                  return `${helpers.prettifyPath(path.join(resourceRootWithSlash, path.relative(dir.to, path.join(dir.from, asset.url))))}`;
               }
            })
         )
         .process(css, {
            parser: safe,
            from: sourceFile,

            // internally it uses path.dirname so we need to supply a filename
            to: path.join(root, 'someFakeInline.css')
         }).css;
   } catch (e) {
      logger.warning({
         message: 'Failed to parse CSS file.',
         filePath: sourceFile,
         error: e
      });
      result = '';
   }

   return result;
}

/**
 * Собирает все @import из склееных css, и перемещает их вверх,
 * т.к. все @import должны быть вверху css
 * @param {String} packedCss - пакованная css
 * @return {String}
 */
function bumpImportsUp(packedCss) {
   let result = packedCss;
   const imports = result.match(importCss);
   if (imports) {
      imports.forEach((anImport) => {
         result = result.replace(anImport, '');
      });
      result = imports.join('\n') + result;
   }

   return result;
}

// removed splitIntoBatches function. Its old function for supporting old IE6-8.
module.exports = {
   rebaseUrls: rebaseUrlsToAbsolutePath,
   bumpImportsUp
};
