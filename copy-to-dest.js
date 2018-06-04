'use strict';

const fs = require('fs-extra'),
   path = require('path'),
   packageObj = require('./package.json');

const dest = path.join(__dirname, 'dest');
if (fs.pathExistsSync(dest)) {
   fs.removeSync(dest);
}
fs.ensureDirSync(dest);

// files используем из package.json, чтобы было как можно более стандартно.
// и работала проверка no-unpublished-require
for (const fileOrDir of packageObj.files) {
   fs.copySync(path.join(__dirname, fileOrDir), path.join(dest, fileOrDir));
}

const srcPathPackageJson = path.join(__dirname, 'package.json');
const destPathPackageJson = path.join(dest, 'package.json');
let textPackageJson = fs.readFileSync(srcPathPackageJson).toString();
if (process.env.hasOwnProperty('BUILD_NUMBER')) {
   textPackageJson = textPackageJson.replace('BUILD', process.env.BUILD_NUMBER);
}
fs.writeFileSync(destPathPackageJson, textPackageJson);
