'use strict';

const helpers = require('./../../lib/domHelpers');
const cssHelpers = require('./../../lib/cssHelpers');
const fs = require('fs-extra');
const async = require('async');
const pMap = require('p-map');
const dblSlashes = /\\/g;

module.exports = {
   gruntPackCSS: function(htmlFiles, root, packageHome) {
      function collector(dom) {
         const links = dom.getElementsByTagName('link'),
            files = [],
            elements = [];
         let
            before, link, href, packName, rel, media;
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
            if (href && rel === 'stylesheet' && media === 'screen' &&
               href.indexOf('http') !== 0 &&
               href.indexOf('//') !== 0 &&
               href.indexOf('.css') !== href.length - 3) {
               //убираем версию из линка, чтобы не возникало проблем с чтением fs-либой
               href = href.replace(/\.v.+?(\.css)$/, '$1');
               files.push(href);
               elements.push(link);
               before = link.nextSibling;
            }
         }

         return [{
            files: files,
            nodes: elements,
            before: before
         }];
      }

      function packer(files, root) {
         return cssHelpers.splitIntoBatches(4000, cssHelpers.bumpImportsUp(files.map(function(css) {
            return cssHelpers.rebaseUrls(root, css, fs.readFileSync(css));
         }).join('\n')));
      }

      function getTargetNode(dom, path) {
         return helpers.mkDomNode(dom, 'link', {
            rel: 'stylesheet',
            href: '/' + path.replace(dblSlashes, '/')
         });
      }

      helpers.package(htmlFiles, root, packageHome, collector, packer, getTargetNode, 'css');
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
   packCSS: function(files, root, callback) {
      function _read(css, cb) {
         fs.readFile(css, function(err, content) {
            if (err) {
               cb(err);
            } else {
               cb(null, cssHelpers.rebaseUrls(root, css, content.toString()));
            }
         });
      }

      files = files.filter(function(file) {
         if (!fs.existsSync(file)) {
            return false;
         }
         return true;
      });
      async.map(files, function(css, cb) {
         _read(css, cb);
      }, function(err, results) {
         if (err) {
            callback(err);
         } else {
            let res = results.join('\n');
            res = cssHelpers.bumpImportsUp(res);
            callback(null, cssHelpers.splitIntoBatches(4000, res));
         }
      });
   },
   promisedPackCSS: async(files, applicationRoot) => {
      const results = await pMap(
         files,
         async css => {
            if (await fs.pathExists(css)) {
               const content = await fs.readFile(css);
               return cssHelpers.rebaseUrls(applicationRoot, css, content.toString());
            }
         },
         {
            concurrency: 10
         }
      );

      return cssHelpers.bumpImportsUp(results.join('\n'));
   }
};
