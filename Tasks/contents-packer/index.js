/**
 * Index
 */

'use strict';

var
   packerModule = require('./packer'),
   serviceRoot, contents, dependencies, packer;



module.exports = function(options, cb) {
   serviceRoot = options.root;
   contents = options.contents;
   dependencies = options.deps;
   packer = new packerModule(serviceRoot, contents, dependencies);

   packer.run(cb);
};

