'use strict';

const through = require('through2');

module.exports = function readModuleMDeps(depsTree) {
   return through.obj(function onTransform(file, encoding, callback) {
      const moduleMDeps = JSON.parse(file.contents),
         currentNodes = Object.keys(moduleMDeps.nodes),
         currentLinks = Object.keys(moduleMDeps.links);
      if (currentLinks.length > 0) {
         currentLinks.forEach((link) => {
            depsTree.setLink(link, moduleMDeps.links[link]);
         });
      }
      if (currentNodes.length > 0) {
         currentNodes.forEach((node) => {
            const currentNode = moduleMDeps.nodes[node];
            currentNode.path = currentNode.path.replace(/^resources\//, '');
            depsTree.setNode(node, currentNode);
         });
      }
      callback();
   });
};
