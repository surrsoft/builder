'use strict';

const domHelpers = require('./../../lib/domHelpers');
const cssHelpers = require('./../../lib/cssHelpers');
const fs = require('fs-extra');
const async = require('async');
const pMap = require('p-map');
const helpers = require('../../../lib/helpers');

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
         Object.keys(filesToPack).map(filePath => cssHelpers.rebaseUrls(currentRoot, filePath, filesToPack[filePath])).join('\n')
      )
   );
}

function cssGetTargetNode(dom, filePath) {
   return domHelpers.mkDomNode(dom, 'link', {
      rel: 'stylesheet',
      href: `/${helpers.prettifyPath(filePath)}`
   });
}


function packageSingleCss(filePath, dom, root, packageHome) {
   return domHelpers.packageSingleFile(filePath, dom, root, packageHome, cssCollector, cssPacker, cssGetTargetNode, 'css');
}

module.exports = {
   packageSingleCss,
   gruntPackCSS(htmlFiles, root, packageHome) {
      return pMap(
         htmlFiles,
         async(filePath) => {
            const dom = domHelpers.domify(await fs.readFile(filePath, 'utf-8'));
            const newDom = await packageSingleCss(filePath, dom, root, packageHome);
            await fs.writeFile(filePath, domHelpers.stringify(newDom));
         },
         { concurrency: 20 }
      );
   },

   /**
    * @callback packCSS~callback
    * @param {Error} error
    * @param {String} [result]
    */
   /**
    * Пакует переданные css. Делит пакет на пачки по 4000 правил (ie8-9)
    * @param {Array.<String>} files - пути до файлов
    * @param {String} root - корень сайта
    * @param {packCSS~callback} callback
    */
   packCSS(files, root, callback) {
      function read(css, cb) {
         fs.readFile(css, (err, content) => {
            if (err) {
               cb(err);
            } else {
               cb(null, cssHelpers.rebaseUrls(root, css, content.toString()));
            }
         });
      }

      const filesToRead = files.filter(file => fs.existsSync(file));
      async.map(
         filesToRead,
         (css, cb) => {
            read(css, cb);
         },
         (err, results) => {
            if (err) {
               callback(err);
            } else {
               let res = results.join('\n');
               res = cssHelpers.bumpImportsUp(res);
               callback(null, cssHelpers.splitIntoBatches(4000, res));
            }
         }
      );
   },
   promisedPackCSS: async(files, applicationRoot) => {
      const results = await pMap(
         files,
         async(css) => {
            if (await fs.pathExists(css)) {
               const content = await fs.readFile(css);
               return cssHelpers.rebaseUrls(applicationRoot, css, content.toString());
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
