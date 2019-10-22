'use strict';

const helpers = require('../helpers'),
   transliterate = require('../transliterate');

const DoT = global.requirejs('Core/js-template-doT');

const { requireJsSubstitutions } = require('../builder-constants');

function buildXhtml(text, relativeFilePath) {
   const prettyRelativeFilePath = helpers.removeLeadingSlashes(helpers.prettifyPath(relativeFilePath));
   let currentNode = prettyRelativeFilePath.replace(/\.xhtml$/g, '');
   for (const pair of requireJsSubstitutions) {
      if (currentNode.startsWith(pair[0])) {
         currentNode = currentNode.replace(pair[0], pair[1]);
         break;
      }
   }

   // currentNode может содержать пробелы. Нужен transliterate
   currentNode = transliterate(`html!${currentNode}`);

   const config = DoT.getSettings();

   const template = DoT.template(text, config);
   const contents =
      `define("${currentNode}",function(){` +
      `var f=${template.toString().replace(/[\n\r]/g, '')};` +
      'f.toJSON=function(){' +
      `return {$serialized$:"func", module:"${currentNode}"}` +
      '};return f;});';
   return {
      nodeName: currentNode,
      text: contents
   };
}

module.exports = {
   buildXhtml
};
