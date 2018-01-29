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

   error(message) {
      if (typeof message === 'string') {
         gulplog.error(this._prepareStringMessage('ERROR', message));
      } else {
         gulplog.error(this._prepareObjectMessage('ERROR', message));
      }
   }

   warning(message) {
      if (typeof message === 'string') {
         gulplog.warn(this._prepareStringMessage('WARNING', message));
      } else {
         gulplog.warn(this._prepareObjectMessage('WARNING', message));
      }
   }

   info(message) {
      gulplog.info(this._prepareStringMessage('INFO', message));
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

   /* Пример obj: {
      code: 1,
      message: 'Ошибка при обработке шаблона',
      error: error,
      module: module,
      filePath: file.history[0]
   }
   */
   _prepareObjectMessage(type, obj) {
      let messages = [];
      if (obj.hasOwnProperty('message')) {
         messages.push(obj['message']);
      }
      if (obj.hasOwnProperty('error')) {
         messages.push(obj['error'].message);
      }
      let locations = [];
      if (obj.hasOwnProperty('moduleInfo')) {
         locations.push('module: ' + obj['moduleInfo'].nameWithResponsible);
      }
      if (obj.hasOwnProperty('filePath')) {
         locations.push('file: ' + obj['filePath']);
      }

      if (obj.hasOwnProperty('error')) {
         this.debug('Stack: ' + obj['error'].stack);
      }
      return this._prepareStringMessage(type, `location: [${locations.join(', ')}] ${messages.join(': ')}`);
   }

   _prepareStringMessage(level, message, code) {

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
