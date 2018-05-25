'use strict';

const logger = require('../../lib/logger').logger();

/**
 * Dependency graph
 * @constructor
 */
function DepGraph() {
   this._nodes = {};
   this._links = {};
   this._path = [];
   this._n = 0;
}

DepGraph.prototype._visitNode = function visitNode(maxLvl, name) {
   if (this._path.length >= maxLvl) {
      return;
   }

   this._path.push(name);

   const nodes = this._nodes,
      links = this._links,
      node = nodes[name];

   if (node) {
      if (node.mark > 0) {
         if (node.mark === 1) {
            logger.warning('Cycle dependency detected: ' + this._path.join(', '));
         }
         this._path.pop();
         return;
      }

      node.mark = 1;
      (links[name] || []).forEach(visitNode.bind(this, maxLvl));
      node.mark = 2;
      node.weight = this._n++;
   } else if (name && name.indexOf('is!') > -1) {
      nodes[name] = {
         mark: 2,
         weight: this._n++,
         path: ''
      };
   } else if (name && name.indexOf('browser!') > -1) {
      visitNode.call(this, maxLvl, name.replace('browser!', ''));
   } else if (name && name.indexOf('optional!') > -1) {
      visitNode.call(this, maxLvl, name.replace('optional!', ''));
   }

   this._path.pop();
};

/**
 * Guided starting vertex startNodes build an array of all vertex in accordance with the dependencies.
 * @param {Array} startNodes
 * @param {Number} [maxLevel=Infinity]
 * @returns {Array}
 */
DepGraph.prototype.getLoadOrder = function(startNodes, maxLevel) {
   const self = this;

   maxLevel = maxLevel || Infinity;

   this._n = 0;

   if (!startNodes || !startNodes.length) {
      return [];
   }

   Object.keys(this._nodes).forEach(function(node) {
      // Fill meta
      self._nodes[node].mark = 0;
      self._nodes[node].weight = -1;
   });

   startNodes.forEach(this._visitNode.bind(this, maxLevel));

   // Iterate over all nodes
   return Object.keys(this._nodes).map(function(k) {
      // node-name -> node (+ module name)
      const meta = self._nodes[k];
      meta.module = k;
      return meta;
   }).filter(function(node) {
      // leave only the nodes that have weight > 0, that is visited when traversing
      return node.weight >= 0;
   }).sort(function(a, b) {
      // sort by weight
      return a.weight - b.weight;
   });
};

/**
 * Add dependency for node
 * @param {String} name
 * @param {Array} dependencies
 */
DepGraph.prototype.addDependencyFor = function(name, dependencies) {
   if (this.hasNode(name)) {
      this._links[name] = dependencies;
   }
};

/**
 * Register new node
 * @param {String} name
 * @param {Object} meta
 */
DepGraph.prototype.registerNode = function(name, meta) {
   this._nodes[name] = meta;
};

/**
 * Check node exist
 * @param {String} name
 * @return {Boolean}
 */
DepGraph.prototype.hasNode = function(name) {
   return name in this._nodes;
};

/**
 * @return {String}
 */
DepGraph.prototype.toJSON = function() {
   return JSON.stringify({
      nodes: this._nodes,
      links: this._links
   }, null, 2);
};

/**
 * Build graph for json
 * @param {String|Object} json
 */
DepGraph.prototype.fromJSON = function(json) {
   const data = typeof json === 'string' ? JSON.parse(json) : json;
   this._nodes = data.nodes;
   this._links = data.links;
   return this;
};

/**
 * Get node dependencies
 * @param {String} name
 * @return {Array}
 */
DepGraph.prototype.getDependenciesFor = function(name) {
   if (this.hasNode(name)) {
      return (this._links[name] || []).slice();
   } else {
      return [];
   }
};

/**
 * Get all nodes name
 * @return {Array}
 */
DepGraph.prototype.getNodes = function() {
   return Object.keys(this._nodes);
};

/**
 * Get node meta data
 * @param {String} name
 * @return {Object}
 */
DepGraph.prototype.getNodeMeta = function(name) {
   return this._nodes[name] || {};
};

module.exports = DepGraph;
