'use strict';

const fs = require('fs-extra');
const domHelpers = require('./../../lib/domHelpers');
const pMap = require('p-map');

function jsCollector(dom) {
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

function jsPacker(filesToPack) {
   return [Object.values(filesToPack).join(';\n')];
}

function jsNodeProducer(dom, path, buildNumber) {
   let scriptPath = path;
   if (buildNumber) {
      scriptPath = scriptPath.replace(/\.js$/, `.v${buildNumber}.js`);
   }
   const script = domHelpers.mkDomNode(dom, 'script', {
      type: 'text/javascript',
      charset: 'utf-8',
      src: `/${scriptPath.replace(/\\/g, '/')}`
   });
   script.textContent = ' ';
   return script;
}

function packageSingleJs(filePath, dom, root, packageHome, buildNumber) {
   return domHelpers.packageSingleFile(filePath, dom, root, packageHome, buildNumber, jsCollector, jsPacker, jsNodeProducer, 'js');
}
function gruntPackJS(htmlFiles, root, packageHome, buildNumber) {
   return pMap(
      htmlFiles,
      async(filePath) => {
         const dom = domHelpers.domify(await fs.readFile(filePath, 'utf-8'));
         const newDom = await packageSingleJs(filePath, dom, root, packageHome, buildNumber);
         await fs.writeFile(filePath, domHelpers.stringify(newDom));
      },
      { concurrency: 20 }
   );
}


module.exports = {
   packageSingleJs,
   gruntPackJS
};
