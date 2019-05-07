/* eslint-disable no-console, max-classes-per-file */

'use strict';
const humanize = require('humanize');

let logger = null;

class Logger {
   constructor(logsLevel) {
      this._hasErrors = false;
      this._hasWarnings = false;
      this._logInfo = !logsLevel || logsLevel === 'info';
      this._logWarnings = this._logInfo || logsLevel === 'warning';
   }

   // нам нужно собрать дистрибутив полностью, вывести все ошибки и только после свалится с кодом выхода 1 или 6.
   // а grunt так не умеет. он может лишь падать при первой ошибке.
   correctExitCode(exitWithWarning = true) {
      if (this._hasErrors) {
         process.exit(1);
      } else if (this._hasWarnings && exitWithWarning) {
         // grunt такой же код выдаёт на варнинги. legacy, которое поддержано в jinnee
         process.exit(6);
      }
   }
}

class GulpLogger extends Logger {
   constructor(logsLevel) {
      super(logsLevel);
      this._lastPercentStr = '';
      this._messages = [];
      this._appInfo = {
         application: '',
         responsible: ''
      };
   }

   setBaseInfo(application, responsible) {
      this._appInfo = {
         application,
         responsible
      };
   }

   error(message) {
      this._hasErrors = true;
      this._consoleLog('ERROR', message);
      this._addMessageForReport('error', message, this._appInfo);
   }

   warning(message) {
      this._hasWarnings = true;
      if (this._logWarnings) {
         this._consoleLog('WARNING', message);
      }
      this._addMessageForReport('warning', message, this._appInfo);
   }

   info(message) {
      if (this._logInfo) {
         this._consoleLog('INFO', message);
      }
   }

   debug(message) {
      if (this._logInfo) {
         this._consoleLog('', message);
      }
   }

   progress(percent) {
      const currentPercentStr = percent.toFixed(0);
      if (currentPercentStr !== this._lastPercentStr) {
         // выводим без [INFO]
         this._consoleLog('', `[PERCENT_COMPLETE] ${currentPercentStr}`);
         this._lastPercentStr = currentPercentStr;
      }
   }

   /* obj может быть строкой или объектом: {
      code: 1,
      message: 'Ошибка при обработке шаблона',
      error: error,
      moduleInfo: moduleInfo,
      filePath: file.history[0]
   }
   */
   _consoleLog(level, obj) {
      let formattedMessage = '';
      let formattedMessageWithStack = '';
      if (typeof obj === 'string') {
         formattedMessage = obj;
      } else {
         const messages = [];

         if (obj.hasOwnProperty('message') && obj.message) {
            messages.push(obj.message);
         }
         if (obj.hasOwnProperty('error') && obj.error && obj.error.message) {
            messages.push(obj.error.message);
         }

         const locations = [];
         if (obj.hasOwnProperty('moduleInfo') && obj.moduleInfo && obj.moduleInfo.nameWithResponsible) {
            locations.push(`module: ${obj.moduleInfo.nameWithResponsible}`);
         }
         if (obj.hasOwnProperty('filePath') && obj.filePath) {
            locations.push(`file: ${obj.filePath}`);
         }
         if (obj.hasOwnProperty('error') && obj.error && obj.error.stack) {
            formattedMessageWithStack = `Stack: ${obj.error.stack}`;
         }
         let formattedLocation = '';
         if (locations.length > 0) {
            formattedLocation = `location: [${locations.join(', ')}] `;
         }
         formattedMessage = `${formattedLocation}${messages.join(': ')}`;
      }
      let formattedLevel = '';
      if (level) {
         formattedLevel = `[${level}] `;
      }
      console.log(`[${humanize.date('H:i:s')}] ${formattedLevel}${formattedMessage}`);
      if (formattedMessageWithStack) {
         this.debug(formattedMessageWithStack);
      }
   }

   _addMessageForReport(level, obj, appInfo) {
      const result = {
         level,
         message: '',
         'cld_name': appInfo.application,
         'cld_responsible': appInfo.responsible
      };

      if (typeof obj === 'string') {
         result.message = obj;
      } else {
         if (obj.hasOwnProperty('message') && obj.message) {
            result.message += obj.message;
         }
         if (obj.hasOwnProperty('error') && obj.error && (obj.error.message || obj.error.stack)) {
            if (result.message) {
               result.message += '\nError: ';
            }
            if (obj.error.message) {
               result.message += obj.error.message;
            }
            if (obj.error.stack) {
               result.message += `\nStack: ${obj.error.stack}`;
            }
         }

         if (obj.hasOwnProperty('moduleInfo') && obj.moduleInfo) {
            result.module = obj.moduleInfo.name;
            result.responsibleOfModule = obj.moduleInfo.responsible;
         }
         if (obj.hasOwnProperty('filePath') && obj.filePath) {
            result.file = obj.filePath;
         }
      }
      this._messages.push(result);
   }

   addMessagesFromWorker(messages) {
      if (messages) {
         for (const msg of messages) {
            this._messages.push(msg);
         }
      }
   }

   getMessageForReport() {
      return this._messages;
   }

   getMessagesLevel() {
      return {
         warnings: this._hasWarnings,
         errors: this._hasErrors
      };
   }
}
class WorkerLogger extends GulpLogger {
   constructor(logsLevel) {
      super(logsLevel);
      this._filePath = null;
      this._moduleInfo = null;
   }

   setInfo(filePath = null, moduleInfo = null) {
      this._filePath = filePath;
      this._moduleInfo = moduleInfo;
      this._messages = [];
   }

   error(message) {
      this._outputWithInfo('error', message);
   }

   warning(message) {
      this._outputWithInfo('warning', message);
   }

   info(message) {
      this._outputWithInfo('info', message);
   }

   debug(message) {
      this._outputWithInfo('debug', message);
   }

   _outputWithInfo(level, message) {
      if (typeof message === 'object') {
         super[level]({
            ...message,
            filePath: this._filePath,
            moduleInfo: this._moduleInfo
         });
      } else {
         super[level]({
            message,
            filePath: this._filePath,
            moduleInfo: this._moduleInfo
         });
      }
   }
}
module.exports = {
   setGulpLogger(logsLevel) {
      if (!logger) {
         logger = new GulpLogger(logsLevel);
      }
      return logger;
   },
   setWorkerLogger(logsLevel) {
      if (!logger) {
         logger = new WorkerLogger(logsLevel);
      }
      return logger;
   },
   logger() {
      if (!logger) {
         throw new Error('Логгер не был инициализирован!');
      }
      return logger;
   }
};
