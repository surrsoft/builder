/*eslint-disable max-nested-callbacks*/
'use strict';

const path = require('path');
const fs = require('fs-extra');
const helpers = require('../lib/helpers');
const humanize = require('humanize');
const logger = require('../lib/logger').logger();

module.exports = function(grunt) {
   grunt.registerMultiTask('gzip', 'Archive resources', function() {
      grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача архивации ресурсов.`);
      const start = Date.now();
      const
         done = this.async(),
         root = this.data.root,
         application = this.data.application,
         applicationRoot = path.join(root, application),
         patterns = this.data.src;
      let i = 0;

      helpers.recurse(applicationRoot, function(file, callback) {
         if (helpers.validateFile(path.relative(applicationRoot, file), patterns)) {
            fs.readFile(file, (err, text) => {
               if (err) {
                  grunt.fail.fatal(err);
                  return callback(err);
               }

               if (text.byteLength > 1024) {
                  helpers.writeGzip(`${file}.gz`, text, function() {
                     if (++i % 1000 === 0) {
                        logger.debug(`${i} files processed`);
                     }
                     callback();
                  });
               } else {
                  callback();
               }
            });
         } else {
            callback();
         }
      }, function(err) {
         if (err) {
            grunt.fail.fatal(err);
         }

         logger.debug(`Duration: ${(Date.now() - start) / 1000} sec. ${i} files processed`);
         done();
      });
   });
};
