'use strict';

const minimatch = require('minimatch');
const esprima = require('esprima');
const mkdirp = require('mkdirp');
const async = require('async');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const writeOptions = {flag: 'wx'};
const gzOptions = {
    level: zlib.Z_BEST_COMPRESSION,
    strategy: zlib.Z_DEFAULT_STRATEGY
};

function _copyFile(target, dest, data, cb) {
    if (data) {
        _writeFile(dest, data, cb);
    } else {
        fs.readFile(target, (err, data) => {
            if (err) {
                console.log(`[ERROR]: ${err}`);
                cb();
            } else {
                _writeFile(dest, data, cb);
            }
        });
    }
}

function _mkSymlink(target, dest, cb) {
    let link = function (target, dest, cb) {
        fs.symlink(target, dest, (err) => {
            if (err && err.code === 'ENOENT') {
                mkdirp(path.dirname(dest), (err) => {
                    if (!err || err.code === 'EEXIST') {
                        link(target, dest, cb);
                    } else {
                        console.log(`[ERROR]: ${err}`);
                        cb();
                    }
                });
            } else if (err && err.code !== 'EEXIST') {
                console.log(`[ERROR]: ${err}`);
                cb();
            } else {
                cb();
            }
        });
    };

    link(target, dest, cb);
}

function _recurse(input, handler, done, limit) {
    fs.readdir(input, function (err, files) {
        if (!err) {
            async.eachLimit(files, limit || 20, function (file, cb) {
                file = file.normalize();
                let abspath = path.join(input, file);

                fs.lstat(abspath, function (err, stats) {
                    if (!err) {
                        if (stats.isDirectory()) {
                            _recurse(abspath, handler, cb, ((limit / 1.2) >> 0) || 1);
                        } else {
                            handler(abspath, cb);
                        }
                    } else {
                        cb(err);
                    }
                });
            }, function (err) {
                done(err);
            });
        }
    });
}

function _validateFile(file, patterns) {
    let passed = false;

    for (let i = 0; i < patterns.length; i++) {
        let pattern = patterns[i];
        let neg = pattern.charAt(0) === '!';

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

function _parseModule(module) {
    let res;
    try {
        res = esprima.parse(module);
    } catch (e) {
        res = e;
    }
    return res;
}

function _percentage(x, all) {
    return Math.floor((x * 100) / all);
}

function _sortObject(obj, comparator) {
    let sorted = {};
    Object.keys(obj)
        .sort(comparator)
        .forEach(function (key) {
            let val = obj[key];
            if (Array.isArray(val)) {
                sorted[key] = val.sort();
            } else  if (val instanceof Object){
                sorted[key] = _sortObject(val, comparator);
            } else {
                sorted[key] = val;
            }
        });
    return sorted;
}

function _writeFile(dest, data, cb) {
    fs.writeFile(dest, data, writeOptions, function (err) {
        if (err && err.code === 'ENOENT') {
            mkdirp(path.dirname(dest), function (err) {
                if (!err || err.code === 'EEXIST') {
                    _writeFile(dest, data, cb);
                } else {
                    console.log(`[ERROR]: ${err}`);
                    cb();
                }
            });
        } else if (err && err.code !== 'EEXIST') {
            console.log(`[ERROR]: ${err}`);
            cb();
        } else {
            cb();
        }
    });
}

function _writeFileWithGZ(dest, data, cb) {
    async.parallel([
        function (callback) {
            _writeFile(dest, data, callback);
        },
        function (callback) {
            zlib.gzip(data, gzOptions, function (err, compressed) {
                if (!err) {
                    _writeFile(`${dest}.gz`, compressed, callback);
                } else {
                    if (err.code !== 'EEXIST') {
                        console.log(`[ERROR]: ${err}`);
                    }
                    callback();
                }
            });
        }
    ], function (err) {
        cb(err);
    });
}

function _writeFileSync(dest, data) {
    try {
        fs.writeFileSync(dest, data);
    } catch (err) {
        if (err && err.code === 'ENOENT') {
            try {
                mkdirp.sync(path.dirname(dest));
            } catch (err) {
                if (!err || err.code === 'EEXIST') {
                    _writeFileSync(dest, data);
                } else {
                    throw new Error(err);
                }
            }
        } else if (err && err.code !== 'EEXIST') {
            throw new Error(err);
        }
    }
}

function _writeFileWithGZSync(dest, data) {
    _writeFileSync(dest, data);
    _writeFileSync(`${dest}.gz`, zlib.gzipSync(data, gzOptions));
}

function _writeGzip(dest, data, callback) {
    zlib.gzip(data, gzOptions, function (err, compressed) {
        if (!err) {
            _writeFile(dest, compressed, callback);
        } else {
            //if (err.code !== 'EEXIST') {
                console.log(`[ERROR]: ${err}`);
            //}
            callback();
        }
    });
}

function _writeGzipSync(dest, data) {
    _writeFileSync(dest, zlib.gzipSync(data, gzOptions));
}

module.exports = {
    writeFile: _writeFile,
    writeGzip: _writeGzip,
    writeFileWithGZ: _writeFileWithGZ,
    writeFileSync: _writeFileSync,
    writeGzipSync: _writeGzipSync,
    writeFileWithGZSync: _writeFileWithGZSync,
    copyFile: _copyFile,
    mkSymlink: _mkSymlink,
    recurse: _recurse,
    validateFile: _validateFile,
    parseModule: _parseModule,
    percentage: _percentage,
    sortObject: _sortObject
};