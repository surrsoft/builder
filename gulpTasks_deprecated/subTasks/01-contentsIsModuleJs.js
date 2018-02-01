'use strict';

const translit = require('../../lib/transliterate');

module.exports = opts => {
   if (!opts.node || !opts.contents) {
      return;
   }

   let node  = opts.node;
   let file  = opts.file;
   let mod   = node.arguments[0].value;
   let parts = mod.split('!');

   if (parts[0] == 'js') {
      opts.acc.addContentsJsModule(parts[1], file.relative);
      if (!file.__WS) {
         let module = translit(file.relative.split(/[\\/]/)[0]);
         opts.acc.modulesContents[module].jsModules[parts[1]] = translit(file.relative).replace(/\\/g, '/');
      } else {
         opts.acc.modulesContents.ws.jsModules[parts[1]] = translit(file.relative).replace(/\\/g, '/');
      }

      // opts.contents.jsModules[parts[1]] = translit(file.relative).replace(/\\/g, '/');
      // path.join(tsdModuleName, transliterate(path.relative(input, abspath))).replace(dblSlashes, '/');
   }
};
