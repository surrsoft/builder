/* eslint-disable no-invalid-this */
'use strict';

const through = require('through2'),
   Vinyl = require('vinyl'),
   logger = require('../../../lib/logger').logger();

const includeExts = ['.js', '.json', '.css', '.tmpl', '.woff', '.ttf', '.eot'];

const excludeRegexes = [
   /.*\.min\.js$/,
   /.*\.routes\.js$/,
   /.*\.test\.js$/,
   /\/node_modules\/.*/,
   /\/ServerEvent\/worker\/.*/,
   /.*\.routes\.js$/,
   /.*\.original\.js$/,
   /.*\.modulepack\.js$/,
   /.*\.test\.js$/,
   /.*\.esp\.json$/,
   /.*\/data-providers\/.*\.js$/,
   /.*\/design\/.*\.js$/,
   /.*\/node_modules\/.*\.js$/
];

module.exports = function(moduleInfo, pool) {
   return through.obj(async function(file, encoding, callback) {
      try {
         if (!includeExts.includes(file.extname)) {
            callback(null, file);
            return;
         }

         for (const regex of excludeRegexes) {
            if (regex.test(file.path)) {
               callback(null, file);
               return;
            }
         }

         const gzipContent = await pool.exec('gzip', [file.contents.toString()]);
         this.push(
            new Vinyl({
               base: file.base,
               path: file.path + '.gz',
               contents: Buffer.from(gzipContent),
               history: [...file.history]
            })
         );
      } catch (error) {
         logger.error({
            message: "Ошибка builder'а при архивации",
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
