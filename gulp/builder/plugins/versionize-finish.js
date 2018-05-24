'use strict';

const through = require('through2'),
   logger = require('../../../lib/logger').logger();

const VERSION_STUB = /\.vBUILDER_VERSION_STUB/g;

const includeExts = ['.css', '.js', '.html', '.tmpl', '.xhtml'];

module.exports = function(config, moduleInfo) {
   return through.obj(function(file, encoding, callback) {
      try {
         if (!includeExts.includes(file.extname)) {
            callback(null, file);
            return;
         }

         let version = '';
         if (file.path.match(/\.min\.[^.\\/]+$/) || file.extname === '.html') {
            version = '.v' + config.version;
         }
         const text = file.contents.toString();
         file.contents = Buffer.from(text.replace(VERSION_STUB, version));
      } catch (error) {
         logger.error({
            message: "Ошибка builder'а при версионировании",
            error: error,
            moduleInfo: moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
