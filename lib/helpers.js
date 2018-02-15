'use strict';

const minimatch = require('minimatch');
const mkdirp = require('mkdirp');
const async = require('async');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const logger = require('./logger').logger();

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
      fs.symlink(target, dest, (err) => {
         if (err && err.code === 'ENOENT') {
            mkdirp(path.dirname(dest), (err) => {
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
         async.eachLimit(files, limit || 20, function(file, cb) {
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
         }, function(err) {
            done(err);
         });
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
         mkdirp(path.dirname(dest), function(err) {
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
function _rewriteFile(dest, data, cb) {
   if (_existsSync(dest)) {
      _unlinkSync(dest);
   }
   _writeFile(dest, data, cb);
}

function _writeFileSync(dest, data) {
   try {
      fs.writeFileSync(dest, data);
   } catch (err) {
      if (err && err.code === 'ENOENT') {
         try {
            mkdirp.sync(path.dirname(dest));
         } catch (error) {
            if (!error || error.code === 'EEXIST') {
               _writeFileSync(dest, data);
            } else {
               throw new Error(error);
            }
         }
      } else if (err && err.code !== 'EEXIST') {
         throw new Error(err);
      }
   }
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

function _readFile() {
   return fs.readFile.apply(this, arguments);
}
function _readFileSync() {
   return fs.readFileSync.apply(this, arguments);
}

function _existsSync() {
   return fs.existsSync.apply(this, arguments);
}

function _unlinkSync() {
   return fs.unlinkSync.apply(this, arguments);
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
   if (!filePath) {
      return '';
   }
   return path.normalize(filePath.replace(dblSlashes, '/')).replace(dblSlashes, '/');
}

module.exports = {
   writeFile: _writeFile,
   writeFileSync: _writeFileSync,
   rewriteFile: _rewriteFile,
   writeGzip: _writeGzip,
   copyFile: _copyFile,
   mkSymlink: _mkSymlink,
   recurse: _recurse,
   validateFile: _validateFile,
   percentage: _percentage,
   sortObject: _sortObject,
   readFile: _readFile,
   readFileSync: _readFileSync,
   existsSync: _existsSync,
   unlinkSync: _unlinkSync,
   getFirstDirInRelativePath: getFirstDirInRelativePath,
   prettifyPath: prettifyPath
};
