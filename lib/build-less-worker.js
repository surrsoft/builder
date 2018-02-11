'use strict';

//логгер - прежде всего
const gulpLog = require('gulplog');
require('./logger').setGulpLogger(gulpLog);

const workerPool = require('workerpool'),
   buildLess = require('./build-less');

workerPool.worker({
   buildLess: buildLess
});
