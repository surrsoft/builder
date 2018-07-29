/* eslint-disable no-sync,no-console */
'use strict';

const fs = require('fs-extra'),
   path = require('path');

const dest = path.join(__dirname, 'dest');
const destNodeModules = path.join(dest, 'node_modules');

// все строки в lower case
const filesForRemove = [
   '.eslintrc.yml',
   'license',
   'licence',
   'license.txt',
   'license-mit',
   'license-mit.txt',
   'license.html',
   'license-jsbn',
   'license.bsd',
   '.travis.yml',
   'gruntfile.js',
   '.jshintrc',
   '.npmignore',
   'webpack.config.js',
   'bower.json',
   'makefile',
   '.eslintrc.json',
   'authors',
   '.editorconfig',
   '.eslintignore',
   '.eslintrc',
   'thirdpartynoticetext.txt',
   'copyrightnotice.txt',
   '.mailmap',
   '.jshintignore',
   'changelog',
   '.project',
   'contributors',
   'gulpfile.js',
   '.eslintrc.js',
   '.gitattributes',
   'changes',
   '.lint',
   'usage.txt',
   '.ds_store',
   'appveyor.yml',
   'secret',
   'test.js',
   '.istanbul.yml',
   '.jscs.json',
   '.gitmodules',
   'jsl.node.conf',
   'makefile.targ',
   '.babelrc',
   '.coveralls.yml'
];
const extensionsForRemove = [
   '.md',
   '.markdown',
   '.map',
   '.min.js',
   '.d.ts',
   '.test.js',
   '.log',
   '.svg',
   '.coffee',
   '.h',
   '.html',
   '.bak'
];
const foldersForRemove = ['.bin', '.idea', 'test', 'examples', 'example', '.vscode', '.github'];

function recursiveReadDir(folder, results) {
   const files = fs.readdirSync(folder);
   for (const file of files) {
      const filePath = path.join(folder, file);
      const isDir = fs.statSync(filePath).isDirectory();
      results.push({ path: filePath, isDir });
      if (isDir) {
         recursiveReadDir(filePath, results);
      }
   }
}

function needRemove(filePath, isDir) {
   const basename = path.basename(filePath).toLowerCase();
   if (isDir) {
      if (foldersForRemove.includes(basename)) {
         return true;
      }
   } else {
      if (filesForRemove.includes(basename)) {
         return true;
      }
      for (const ext of extensionsForRemove) {
         if (basename.endsWith(ext)) {
            return true;
         }
      }
   }
   return false;
}

const files = [];
recursiveReadDir(destNodeModules, files);
for (const file of files) {
   if (needRemove(file.path, file.isDir)) {
      console.log(`remove ${file.path}`);
      fs.removeSync(file.path);
   }
}

// package-lock.json уже не нужен после npm ci
fs.removeSync(path.join(dest, 'package-lock.json'));
