'use strict';

const fs = require('fs-extra'),
   path = require('path'),
   packageObj = require('./package.json');

//files используем, чтобы было как можно более стандартно. и работала проверка no-unpublished-require
const filesAndDirsForCopy = [...packageObj.files, 'package.json'];

const dest = path.join(__dirname, 'dest');
if (fs.pathExistsSync(dest)) {
   fs.removeSync(dest);
}
fs.ensureDirSync(dest);

for (const fileOrDir of filesAndDirsForCopy) {
   fs.copySync(path.join(__dirname, fileOrDir), path.join(dest, fileOrDir));
}
