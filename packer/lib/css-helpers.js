'use strict';

const path = require('path');
const postcss = require('postcss');
const postcssUrl = require('postcss-url');
const safe = require('postcss-safe-parser');
const logger = require('../../lib/logger').logger();
const helpers = require('../../lib/helpers');
const invalidUrl = /^(\/|#|data:|[a-z]+:\/\/)(?=.*)/i;
const importCss = /@import[^;]+;/gi;

function rebaseUrlsToAbsolutePath(cssConfig) {
   const {
      root,
      sourceFile,
      css,
      relativePackagePath
   } = cssConfig;
   let result;

   const rootForRebase = path.join(root, relativePackagePath);
   try {
      result = postcss()
         .use(
            postcssUrl({
               url(asset, dir) {
                  // ignore absolute urls, hashes or data uris
                  if (invalidUrl.test(asset.url)) {
                     return asset.url;
                  }

                  /**
                   * path to style can be joined in 2 different ways:
                   * 1) for local demo-examples(f.e. controls) - site root + relative link by site root
                   * 2) for ordinary stand - site root + resources + relative link by site root
                   * A normalized relative path will be returned according to these facts.
                   */
                  return helpers.prettifyPath(
                     path.relative(
                        dir.to,
                        path.join(dir.from, asset.url)
                     )
                  );
               }
            })
         )
         .process(css, {
            parser: safe,
            from: sourceFile,
            to: rootForRebase
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
