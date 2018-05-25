'use strict';

const fs = require('fs-extra');
const helpers = require('./../../lib/domHelpers');

module.exports = function gruntPackJS(htmlFiles, root, packageHome) {
   function collector(dom) {
      const
         scripts = dom.getElementsByTagName('script'),
         packs = {};

      let defId = 0,
         script,
         link,
         packName,
         pack,
         lastPackName,
         type;

      for (let i = 0, l = scripts.length; i < l; i++) {
         script = scripts[i];
         packName = script.getAttribute('data-pack-name') || 'unset';
         type = script.getAttribute('type') || 'text/javascript';
         link = script.getAttribute('src');

         // inline script will split package
         // type other than text/javascript will split package
         // data-pack-name='skip' == skip this script from packing, ignore it at all, don't split package
         if (!link || type !== 'text/javascript' || packName === 'skip') {
            defId++;
            continue;
         }

         if (lastPackName && lastPackName !== packName) {
            defId++;
         }

         lastPackName = packName;
         packName = packName + defId;

         // ends with .js and not starts with http and not starts with // (schema-less urls)
         if (link.indexOf('.js') === link.length - 3 && link.indexOf('http') !== 0 && link.indexOf('//') !== 0) {
            pack =
               packs[packName] ||
               (packs[packName] = {
                  files: [],
                  nodes: [],
                  before: null
               });

            pack.files.push(link);
            pack.nodes.push(script);
            pack.before = script.nextSibling;
         } else {
            // any other script will split package
            defId++;
         }
      }

      return Object.keys(packs).map(k => packs[k]);
   }

   function packer(files) {
      return [files.map(js => fs.readFileSync(js)).join(';\n')];
   }

   function nodeProducer(dom, path) {
      const script = helpers.mkDomNode(dom, 'script', {
         type: 'text/javascript',
         charset: 'utf-8',
         src: `/${path.replace(/\\/g, '/')}`
      });
      script.textContent = ' ';
      return script;
   }

   return helpers.package(htmlFiles, root, packageHome, collector, packer, nodeProducer, 'js');
};
