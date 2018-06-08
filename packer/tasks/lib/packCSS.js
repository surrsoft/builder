'use strict';

const domHelpers = require('./../../lib/domHelpers');
const cssHelpers = require('./../../lib/cssHelpers');
const fs = require('fs-extra');
const pMap = require('p-map');
const helpers = require('../../../lib/helpers');
const path = require('path');

function cssCollector(dom) {
   const links = dom.getElementsByTagName('link'),
      files = [],
      elements = [];
   let before, link, href, packName, rel, media;
   for (let i = 0, l = links.length; i < l; i++) {
      link = links[i];
      packName = link.getAttribute('data-pack-name');

      // data-pack-name='skip' == skip this css from packing
      if (packName === 'skip') {
         continue;
      }

      href = links[i].getAttribute('href');
      rel = links[i].getAttribute('rel');
      media = links[i].getAttribute('media') || 'screen';

      // stylesheet, has href ends with .css and not starts with http or //, media is screen
      if (
         href &&
         rel === 'stylesheet' &&
         media === 'screen' &&
         href.indexOf('http') !== 0 &&
         href.indexOf('//') !== 0 &&
         href.indexOf('.css') !== href.length - 3
      ) {
         files.push(href);
         elements.push(link);
         before = link.nextSibling;
      }
   }

   return [
      {
         files,
         nodes: elements,
         before
      }
   ];
}

function cssPacker(filesToPack, currentRoot) {
   return cssHelpers.splitIntoBatches(
      4000,
      cssHelpers.bumpImportsUp(
         Object.keys(filesToPack)
            .map(filePath => cssHelpers.rebaseUrls(currentRoot, filePath, filesToPack[filePath]))
            .join('\n')
      )
   );
}

function cssGetTargetNode(dom, filePath, buildNumber) {
   let linkPath = filePath;
   if (buildNumber) {
      linkPath = linkPath.replace(/\.css$/, `.v${buildNumber}.css`);
   }
   return domHelpers.mkDomNode(dom, 'link', {
      rel: 'stylesheet',
      href: `/${helpers.prettifyPath(linkPath)}`
   });
}

function packageSingleCss(filePath, dom, root, packageHome, buildNumber, gulp) {
   return domHelpers.packageSingleFile(
      filePath,
      dom,
      root,
      packageHome,
      buildNumber,
      cssCollector,
      cssPacker,
      cssGetTargetNode,
      'css',
      gulp
   );
}

module.exports = {
   packageSingleCss,
   gruntPackCSS(htmlFiles, root, packageHome, buildNumber) {
      return pMap(
         htmlFiles,
         async(filePath) => {
            const dom = domHelpers.domify(await fs.readFile(filePath, 'utf-8'));
            const newDom = await packageSingleCss(filePath, dom, root, packageHome, buildNumber, false);
            await fs.writeFile(filePath, domHelpers.stringify(newDom));
         },
         { concurrency: 20 }
      );
   },

   promisedPackCSS: async(files, applicationRoot, isGulp) => {
      const results = await pMap(
         files,
         async(css) => {
            if (await fs.pathExists(css)) {
               const content = await fs.readFile(css);
               let rebaseRoot;
               if (isGulp) {
                  rebaseRoot = `${helpers.prettifyPath(path.join(applicationRoot, 'resources/'))}`;
               } else {
                  rebaseRoot = applicationRoot;
               }
               return cssHelpers.rebaseUrls(rebaseRoot, css, content.toString());
            }
            return '';
         },
         {
            concurrency: 10
         }
      );

      return cssHelpers.bumpImportsUp(results.join('\n'));
   }
};
