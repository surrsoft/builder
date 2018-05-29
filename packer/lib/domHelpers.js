/* eslint-disable no-await-in-loop */
'use strict';

const crypto = require('crypto');
const xmldom = require('tensor-xmldom');
const fs = require('fs-extra');
const path = require('path');
const parser = new xmldom.DOMParser();
const serializer = new xmldom.XMLSerializer();
const logger = require('../../lib/logger').logger();
const pMap = require('p-map');

function wrap(obj, prop, replacer) {
   ((orig) => {
      obj[prop] = replacer;
      obj[prop].restore = () => {
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
   wrap(console, 'warn', (m) => {
      errors.push(m);
   });
   wrap(console, 'error', (m) => {
      errors.push(m);
   });
   const result = parser.parseFromString(text, 'text/html');

   // eslint-disable-next-line no-console
   console.log.restore();

   // eslint-disable-next-line no-console
   console.warn.restore();

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

async function checkFiles(root, sourceFile, result) {
   const filesNotFound = [];
   for (const packItem of result.files) {
      const fullPath = path.join(root, packItem);
      if (!await fs.pathExists(fullPath)) {
         filesNotFound.push(packItem);
      }
   }

   return filesNotFound.join(', ');
}

async function packageSingleFile(htmlFilePath, dom, root, packageHome, collector, packer, nodeProducer, ext) {
   const
      results = collector(dom).filter(result => result.files.length > 1);

   for (const result of results) {
      // убираем версию из линка, чтобы не возникало проблем с чтением fs-либой
      result.files = result.files.map(filePath => filePath.replace(/\.v.+?(\.css|\.js)$/, '.min$1'));
      const filesNotFound = await checkFiles(root, htmlFilePath, result);
      if (filesNotFound !== '') {
         logger.warning({
            message: `Can't find files for pack: ${filesNotFound}`,
            filePath: htmlFilePath
         });
         continue;
      }
      let filesPathsToPack = result.files.map(fl => path.join(root, fl));

      if (ext === 'css') {
         filesPathsToPack = filesPathsToPack.filter((filename) => {
            const prettyFilename = filename;
            return !(
               prettyFilename.includes('resources/Controls') ||
                     (prettyFilename.includes('resources/SBIS3.CONTROLS') &&
                        !prettyFilename.includes('resources/SBIS3.CONTROLS/themes'))
            );
         });
      }
      const filesToPack = {};
      await pMap(filesPathsToPack, async(filePath) => {
         filesToPack[filePath] = await fs.readFile(filePath, 'utf8');
      }, { concurrency: 5 });

      const packedContent = packer(
         filesToPack,
         root
      );

      const packedFiles = [];
      let idx = 0;

      // For each result content item create uniq filename and write item to it
      for (const aSinglePackedFileContent of packedContent) {
         const packedFile = path.join(packageHome, uniqname(result.files, `${idx}.${ext}`));
         packedFiles.push(packedFile);
         await fs.ensureDir(path.dirname(packedFile));
         await fs.writeFile(packedFile, aSinglePackedFileContent);
         idx++;
      }

      // Remove initial collection from DOM
      removeDomCollection(result.nodes);

      // For each packed file create new DOM node and attach it to document
      for (const aSingleFile of packedFiles) {
         const newNode = nodeProducer(dom, path.relative(root, aSingleFile));
         if (result.before) {
            result.before.parentNode.insertBefore(newNode, result.before);
         } else {
            dom.getElementsByTagName('head')[0].appendChild(newNode);
         }
      }
   }
   return dom;
}

module.exports = {
   uniqname,
   domify,
   stringify,
   mkDomNode,
   mkCommentNode,
   packageSingleFile
};
