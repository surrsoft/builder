'use strict';

let gulpUtil = require('gulp-util'); //TODO: gulp-util не должен загружаться в grunt задачах
function prepareMessage(timestamp, argsObj) {
   let args = [];

   for (let i = 0; i < argsObj.length; i++) {
      args[i] = argsObj[i];
   }

   if (args.length) {
      args[0] = timestamp + args[0];
   }

   return args;

}

class Logger {
   constructor() {
      this._lastPercentStr = '';
      this._locationModule = null;
   }

   set locationModule(module) {
      this._locationModule = module;
   }

   error(code, message) {
      this._prepareMessage('ERROR', code, message);
   }

   warning(code, message) {
      this._prepareMessage('WARNING', code, message);
   }

   info(message) {
      gulpUtil.log(`${message}`);
   }

   progress(percent) {
      const currentPercentStr = percent.toFixed(0);
      if (currentPercentStr !== this._lastPercentStr) {
         this.info(`[PERCENT_COMPLETE] ${currentPercentStr}`);
         this._lastPercentStr = currentPercentStr;
      }
   }

   _prepareMessage(level, code, message) {

      let codeStr = '';
      if (code) {
         codeStr = 'Builder_' + Logger.normalizeCodeError(code.toString());
      }
      let resultMessage = message;
      if (this._locationModule) {
         resultMessage = `{module: "${this._locationModule}"} resultMessage`;
      }
      gulpUtil.log(`[${level}] ${codeStr} ${resultMessage}`);
   }

   static normalizeCodeError(input) {
      const len = 4 - input.length,
         ch = '0';

      let result = '';
      for (let i = 0; i < len; i++) {
         result += ch;
      }
      return result + input;
   }
}

module.exports = {
   setGruntLogger: function(grunt) {
      global.grunt = grunt;

      grunt.log.ok = function() {
         const prefixMode = '[INFO]: ';
         console.log.apply(console, prepareMessage(prefixMode, arguments));
         return grunt.log;
      };
      grunt.log.debug = function() {
         if (!grunt.option('debug')) {
            return;
         }
         const prefixMode = '[DEBUG]: ';
         console.log.apply(console, prepareMessage(prefixMode, arguments));
         return grunt.log;
      };
      grunt.log.warn = function() {
         const prefixMode = '[WARNING]: ';
         console.log.apply(console, prepareMessage(prefixMode, arguments));
         return grunt.log;
      };
      grunt.log.error = function() {
         const prefixMode = '[WARNING]: ';
         console.log.apply(console, prepareMessage(prefixMode, arguments));
         return grunt.log;
      };
   },
   logger: new Logger()
};
