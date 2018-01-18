'use strict';

let gulplog = require('gulplog'); //TODO: gulplog не должен загружаться в grunt задачах
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
   // у логгера 4 уровня сообщений: debug, info, warning, error
   // по умолчанию выводятся только info, warning, error. выводим из в формате понятном jinnee-utility.
   // debug включается флагом -LLLL

   constructor() {
      this._lastPercentStr = '';
      this._locationModule = null;
   }

   error(message, code) {
      if (!code) {
         throw new Error('code required');
      }
      gulplog.error(this._prepareMessage('ERROR', message, code));
   }

   warning(message, code) {
      if (!code) {
         throw new Error('code required');
      }
      gulplog.warn(this._prepareMessage('WARNING', message, code));
   }

   info(message) {
      gulplog.info(this._prepareMessage('INFO', message));
   }

   debug(message) {
      gulplog.debug(`${message}`);
   }

   progress(percent) {
      const currentPercentStr = percent.toFixed(0);
      if (currentPercentStr !== this._lastPercentStr) {
         this.info(`[PERCENT_COMPLETE] ${currentPercentStr}`);
         this._lastPercentStr = currentPercentStr;
      }
   }

   _prepareMessage(level, message, code) {

      let codeStr = '';
      if (code) {
         codeStr = ' Builder_' + Logger.normalizeCodeError(code.toString());
      }
      let resultMessage = message;
      if (this._locationModule) {
         resultMessage = `{module: "${this._locationModule}"} resultMessage`;
      }
      return `[${level}]${codeStr} ${resultMessage}`;
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
