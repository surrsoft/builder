'use strict';

module.exports = opts => {
    if (!opts.node || !opts.contents) return;

    let node  = opts.node;
    let file  = opts.file;
    let mod   = node.arguments[0].value;
    let parts = mod.split('!');

    if (parts[0] == 'js') {
        opts.acc.addContentsJsModule(parts[1], file.relative);
        // opts.contents.jsModules[parts[1]] = translit(file.relative).replace(/\\/g, '/');
        // path.join(tsdModuleName, transliterate(path.relative(input, abspath))).replace(dblSlashes, '/');
    }
};