'use strict';

const crypto = require('crypto');
const xmldom = require('tensor-xmldom');
const fs = require('fs-extra');
const path = require('path');
const parser = new xmldom.DOMParser();
const serializer = new xmldom.XMLSerializer();
const logger = require('../../lib/logger').logger();

function wrap(obj, prop, replacer) {
   (function(orig) {
      obj[prop] = replacer;
      obj[prop].restore = function() {
         obj[prop] = orig;
      };
   })(obj[prop]);
}

function uniqname(names, ext) {
   const md5 = crypto.createHash('md5');
   md5.update(`${names}`);
   return `${md5.digest('hex')}.${ext}`;
}

function domify(text) {
   const errors = [];
   wrap(console, 'log', (m) => {
      errors.push(m);
   });
   wrap(console, 'error', (m) => {
      errors.push(m);
   });
   const result = parser.parseFromString(text, 'text/html');

   // eslint-disable-next-line no-console
   console.log.restore();

   // eslint-disable-next-line no-console
   console.error.restore();

   return result;
}

function stringify(dom) {
   return serializer.serializeToString(dom);
}

function mkDomNode(document, node, attributes) {
   const newNode = document.createElement(node);
   Object.keys(attributes || {}).forEach((attrName) => {
      newNode.setAttribute(attrName, attributes[attrName]);
   });
   if (node === 'script') {
      newNode.textContent = ' ';
   }
   return newNode;
}

function mkCommentNode(document, data) {
   return document.createComment(data);
}

function removeDomCollection(col, filter) {
   const deadlist = [];
   for (let i = 0, l = col.length; i < l; i++) {
      if (!filter || filter(col[i])) {
         deadlist.push(col[i]);
      }
   }
   for (let i = 0, l = deadlist.length; i < l; i++) {
      deadlist[i].parentNode.removeChild(deadlist[i]);
   }
}

function checkFiles(root, sourceFile, result) {
   let isSane = true;
   const errors = [];
   result.files.forEach((packItem, i) => {
      const fullPath = path.join(root, packItem);
      if (!fs.existsSync(fullPath)) {
         const l = result.nodes[i].lineNumber,
            c = result.nodes[i].columnNumber;
         errors.push(`line ${l} col ${c}: file not found ${packItem}`);
         isSane = false;
      }
   });
   if (!isSane) {
      logger.warning(`Warning: ${path.relative(root, sourceFile)} skipped`);
      logger.warning(errors.join('\n'));
   }
   return isSane;
}

const helpers = {
   uniqname,
   domify,
   stringify,
   mkDomNode,
   mkCommentNode,

   package(fileset, root, packageHome, collector, packer, nodeProducer, ext) {
      fileset.forEach((f) => {
         const dom = domify(fs.readFileSync(f, 'utf-8')),
            results = collector(dom);

         results.forEach((result) => {
            let packedContent;
            const packedFiles = [];

            if (result.files.length > 1) {
               if (checkFiles(root, f, result)) {
                  packedContent = packer(
                     result.files.map(fl => path.join(root, fl)).filter(function deleteControls(filename) {
                        if (ext === 'css') {
                           const prettyFilename = filename.replace(/\\/g, '/');
                           return !(
                              prettyFilename.includes('resources/Controls') ||
                              (prettyFilename.includes('resources/SBIS3.CONTROLS') &&
                                 !prettyFilename.includes('resources/SBIS3.CONTROLS/themes'))
                           );
                        }
                        return true;
                     }),
                     root
                  );

                  // For each result content item create uniq filename and write item to it
                  packedContent.forEach((aSinglePackedFileContent, idx) => {
                     const packedFile = path.join(packageHome, uniqname(result.files, `${idx}.${ext}`));
                     packedFiles.push(packedFile);
                     fs.ensureDirSync(path.dirname(packedFile));
                     fs.writeFileSync(packedFile, aSinglePackedFileContent);
                  });

                  // Remove initial collection from DOM
                  removeDomCollection(result.nodes);

                  // For each packed file create new DOM node and attach it to document
                  packedFiles.forEach((aSingleFile) => {
                     const newNode = nodeProducer(dom, path.relative(root, aSingleFile));
                     if (result.before) {
                        result.before.parentNode.insertBefore(newNode, result.before);
                     } else {
                        dom.getElementsByTagName('head')[0].appendChild(newNode);
                     }
                  });

                  // update HTML
                  fs.writeFileSync(f, stringify(dom));

                  logger.debug(`OK  : ${f}`);
               } else {
                  logger.warning({
                     message: 'Skip file',
                     filePath: f
                  });
               }
            }
         });
      });
   }
};

module.exports = helpers;
