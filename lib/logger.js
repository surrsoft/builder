'use strict';

let _logger = null;

class GruntLogger {
   constructor(grunt) {
      this._grunt = grunt;
      this._lastPercentStr = '';
   }

   error(message) {
      if (typeof message === 'string') {
         this._grunt.log.error(message);
      } else {
         this._grunt.log.error(this._prepareObjectMessage(message));
      }
   }

   warning(message) {
      if (typeof message === 'string') {
         this._grunt.log.warn(message);
      } else {
         this._grunt.log.warn(this._prepareObjectMessage(message));
      }
   }

   info(message) {
      this._grunt.log.ok(message);
   }

   debug(message) {
      this._grunt.log.debug(`${message}`);
   }

   progress(percent, text) {
      const currentPercentStr = percent.toFixed(0);
      if (currentPercentStr !== this._lastPercentStr) {

         //eslint-disable-next-line no-console
         console.log('[' + currentPercentStr + '%] ' + text); //выводим без [INFO]
         this._lastPercentStr = currentPercentStr;
      }
   }

   _prepareObjectMessage(obj) {
      let messages = [];
      if (obj.hasOwnProperty('message')) {
         messages.push(obj['message']);
      }
      if (obj.hasOwnProperty('error')) {
         messages.push(obj['error'].message);
      }

      let locations = '';
      if (obj.hasOwnProperty('filePath')) {
         locations = `location: [${obj.filePath}] `;
      }

      if (obj.hasOwnProperty('error') && obj.error.stack) {
         this.info('Stack: ' + obj.error.stack);
      }

      return `${locations}${messages.join(': ')}`;
   }

   static _prepareStringMessage(timestamp, argsObj) {
      let args = [];

      for (let i = 0; i < argsObj.length; i++) {
         args[i] = argsObj[i];
      }

      if (args.length) {
         args[0] = timestamp + args[0];
      }

      return args;
   }
}

class GulpLogger {
   // у логгера 4 уровня сообщений: debug, info, warning, error
   // по умолчанию выводятся только info, warning, error. выводим из в формате понятном jinnee-utility.
   // debug включается флагом -LLLL

   constructor(gulplog) {
      this._lastPercentStr = '';
      this._gulplog = gulplog;
   }

   error(message) {
      if (typeof message === 'string') {
         this._gulplog.error(GulpLogger._prepareStringMessage('ERROR', message));
      } else {
         this._gulplog.error(this._prepareObjectMessage('ERROR', message));
      }
   }

   warning(message) {
      if (typeof message === 'string') {
         this._gulplog.warn(GulpLogger._prepareStringMessage('WARNING', message));
      } else {
         this._gulplog.warn(this._prepareObjectMessage('WARNING', message));
      }
   }

   info(message) {
      this._gulplog.info(GulpLogger._prepareStringMessage('INFO', message));
   }

   debug(message) {
      this._gulplog.debug(`${message}`);
   }

   progress(percent) {
      const currentPercentStr = percent.toFixed(0);
      if (currentPercentStr !== this._lastPercentStr) {
         this.debug(`[PERCENT_COMPLETE] ${currentPercentStr}`); //выводим без [INFO]
         this._lastPercentStr = currentPercentStr;
      }
   }

   /* Пример obj: {
      code: 1,
      message: 'Ошибка при обработке шаблона',
      error: error,
      moduleInfo: moduleInfo,
      filePath: file.history[0]
   }
   */
   _prepareObjectMessage(type, obj) {
      let messages = [];

      let codeStr = '';
      if (obj.hasOwnProperty('code')) {
         codeStr = 'Builder_' + GulpLogger._normalizeCodeError(obj['code'].toString()) + ' ';
      }

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
      if (obj.hasOwnProperty('error') && obj.error.stack) {
         this.debug('Stack: ' + obj.error.stack);
      }

      return GulpLogger._prepareStringMessage(type, `${codeStr}location: [${locations.join(', ')}] ${messages.join(': ')}`);
   }

   static _prepareStringMessage(level, message) {
      return `[${level}] ${message}`;
   }

   static _normalizeCodeError(input) {
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
      if (!_logger) {
         _logger = new GruntLogger(grunt);

         //TODO: избавиться от определения grunt.log.* и перейти везде на использовани класса логгера
         grunt.log.ok = function() {
            const prefixMode = '[INFO]: ';
            // eslint-disable-next-line no-console
            console.log.apply(console, GruntLogger._prepareStringMessage(prefixMode, arguments));
            return grunt.log;
         };
         grunt.log.debug = function() {
            if (!grunt.option('debug')) {
               return;
            }
            const prefixMode = '[DEBUG]: ';
            // eslint-disable-next-line no-console
            console.log.apply(console, GruntLogger._prepareStringMessage(prefixMode, arguments));
            return grunt.log;
         };
         grunt.log.warn = function() {
            const prefixMode = '[WARNING]: ';
            // eslint-disable-next-line no-console
            console.log.apply(console, GruntLogger._prepareStringMessage(prefixMode, arguments));
            return grunt.log;
         };
         grunt.log.error = function() {
            const prefixMode = '[ERROR]: ';
            // eslint-disable-next-line no-console
            console.log.apply(console, GruntLogger._prepareStringMessage(prefixMode, arguments));
            return grunt.log;
         };
      }
      return _logger;
   },
   setGulpLogger: function(gulplog) {
      if (!_logger) {
         _logger = new GulpLogger(gulplog);
      }
      return _logger;
   },
   logger: function() {
      if (!_logger) {
         throw new Error('Логгер не был инициализирован!');
      }
      return _logger;
   }
};
