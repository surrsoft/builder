'use strict';

const minimatch = require('minimatch');
const async = require('async');
const path = require('path');
const fs = require('fs-extra');
const zlib = require('zlib');
const logger = require('./logger').logger();

const isWindows = process.platform === 'win32';

const writeOptions = {flag: 'wx'};
const gzOptions = {
   level: zlib.Z_BEST_COMPRESSION,
   strategy: zlib.Z_DEFAULT_STRATEGY
};

const dblSlashes = /\\/g;

function _copyFile(target, dest, data, cb) {
   if (data) {
      _writeFile(dest, data, cb);
   } else {
      fs.readFile(target, (err, data) => {
         if (err) {
            logger.error({
               error: err
            });
            cb();
         } else {
            _writeFile(dest, data, cb);
         }
      });
   }
}

function _mkSymlink(target, dest, cb) {
   const link = function(target, dest, cb) {
      fs.symlink(target, dest, err => {
         if (err && err.code === 'ENOENT') {
            fs.ensureDir(path.dirname(dest), err => {
               if (!err || err.code === 'EEXIST') {
                  link(target, dest, cb);
               } else {
                  logger.error({
                     error: err
                  });
                  cb();
               }
            });
         } else if (err && err.code !== 'EEXIST') {
            logger.error({
               error: err
            });
            cb();
         } else {
            cb();
         }
      });
   };

   link(target, dest, cb);
}

function _recurse(input, handler, done, limit) {
   fs.readdir(input, function(err, files) {
      if (!err) {
         async.eachLimit(
            files,
            limit || 20,
            function(file, cb) {
               file = file.normalize();
               const abspath = path.join(input, file);

               fs.lstat(abspath, function(err, stats) {
                  if (!err) {
                     if (stats.isDirectory()) {
                        _recurse(abspath, handler, cb, limit / 1.2 >> 0 || 1);
                     } else {
                        handler(abspath, cb);
                     }
                  } else {
                     cb(err);
                  }
               });
            },
            function(err) {
               done(err);
            }
         );
      }
   });
}

function _validateFile(file, patterns) {
   let passed = false;

   for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const neg = pattern.charAt(0) === '!';

      if (minimatch(file, pattern)) {
         if (!neg) {
            passed = true;
         }
      } else {
         if (neg) {
            passed = false;
            break;
         }
      }
   }

   return passed;
}

function _percentage(x, all) {
   return Math.floor(x * 100 / all);
}

function _sortObject(obj, comparator) {
   const sorted = {};
   Object.keys(obj)
      .sort(comparator)
      .forEach(function(key) {
         const val = obj[key];
         if (Array.isArray(val)) {
            sorted[key] = val.sort();
         } else if (val instanceof Object) {
            sorted[key] = _sortObject(val, comparator);
         } else {
            sorted[key] = val;
         }
      });
   return sorted;
}

function _writeFile(dest, data, cb) {
   fs.writeFile(dest, data, writeOptions, function(err) {
      if (err && err.code === 'ENOENT') {
         fs.ensureDir(path.dirname(dest), function(err) {
            if (!err || err.code === 'EEXIST') {
               _writeFile(dest, data, cb);
            } else {
               logger.error({
                  error: err
               });
               cb();
            }
         });
      } else if (err && err.code !== 'EEXIST') {
         logger.error({
            error: err
         });
         cb();
      } else {
         cb();
      }
   });
}

function _writeGzip(dest, data, callback) {
   zlib.gzip(data, gzOptions, function(err, compressed) {
      if (!err) {
         _writeFile(dest, compressed, callback);
      } else {
         logger.error({
            error: err
         });
         callback();
      }
   });
}

function gzip(data) {
   return new Promise((resolve, reject) => {
      zlib.gzip(data, gzOptions, (err, compressed) => {
         if (err) {
            reject(err);
         } else {
            resolve(compressed);
         }
      });
   });
}

function _readFile() {
   return fs.readFile.apply(this, arguments);
}

//получить первую папку в относительном пути. нужно для получения папки модуля
function getFirstDirInRelativePath(relativePath) {
   const parts = relativePath.replace(dblSlashes, '/').split('/');

   // в пути должно быть минимум два элемента: имя папки модуля и имя файла.
   if (parts.length < 2) {
      return relativePath;
   }
   return parts[0] || parts[1]; //если путь начинается со слеша, то первый элемент - пустая строка
}

function prettifyPath(filePath) {
   if (!filePath || typeof filePath !== 'string') {
      return '';
   }

   //специальная обработка для путей сетевого SDK, что используется для сборки под Windows на Jenkins
   if (isWindows && /^[\\|/]{2}.*/.test(filePath)) {
      return '\\' + filePath.replace(/\//g, '\\').replace(/\\\\/g, '\\');
   }

   return path
      .normalize(filePath)
      .replace(dblSlashes, '/')
      .replace(/\/\//g, '/');
}

function removeLeadingSlash(filePath) {
   let newFilePath = filePath;
   if (newFilePath) {
      const head = newFilePath.charAt(0);
      if (head === '/' || head === '\\') {
         newFilePath = newFilePath.substr(1);
      }
   }
   return newFilePath;
}

async function tryRemoveFolder(folder) {
   try {
      await fs.remove(folder);
   } catch (e) {
      return e;
   }
   return null;
}

const delay = function(ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
};

const promisifyDeferred = function(deferred) {
   return new Promise((resolve, reject) => {
      deferred
         .addCallback(result => {
            resolve(result);
         })
         .addErrback(error => {
            reject(error);
         });
   });
};

module.exports = {
   writeFile: _writeFile,
   writeGzip: _writeGzip,
   copyFile: _copyFile,
   mkSymlink: _mkSymlink,
   recurse: _recurse,
   validateFile: _validateFile,
   percentage: _percentage,
   sortObject: _sortObject,
   readFile: _readFile,
   getFirstDirInRelativePath: getFirstDirInRelativePath,
   prettifyPath: prettifyPath,
   removeLeadingSlash: removeLeadingSlash,
   tryRemoveFolder: tryRemoveFolder,
   delay: delay,
   promisifyDeferred: promisifyDeferred,
   gzip: gzip
};
