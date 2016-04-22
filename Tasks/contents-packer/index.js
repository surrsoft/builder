/**
 * Index
 */

'use strict';

var
   packerModule = require('./packer');



module.exports = function(options, cb) {
   var packer = new packerModule(options.root, options.contents, options.deps);

   packer.run(cb);
};

