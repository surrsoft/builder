/**
 * API for native gulp watcher.
 */
'use strict';

const logger = require('../../lib/logger').logger();
const { exec } = require('child_process');
const ConfigurationReader = require('../common/configuration-reader');
const processParameters = ConfigurationReader.getProcessParameters(process.argv);
const processOptions = {
   maxBuffer: 1024 * 500,
   cwd: process.cwd()
};

/**
 * main class for watcher function -
 * what and how to execute when there is a file to rebuild
 */
class WatcherTask {
   constructor() {
      this.errors = [];
      this.warnings = [];
      this.hasErrors = false;
      this.hasWarnings = false;
      this.childProcess = null;
   }

   /**
    * catch all of output from process to log everything that is happening
    * inside of child_process(executes gulp task to rebuild single file)
    */
   processOutputEmit() {
      this.childProcess.stdout.on('data', (data) => {
         const dataString = data.toString();
         logger.debug(data.toString());
         if (dataString.includes('[ERROR]')) {
            this.errors.push(dataString);
            this.hasErrors = true;
         }
         if (dataString.includes('[WARNING]')) {
            this.warnings.push(dataString);
            this.hasWarnings = true;
         }
      });
   }

   /**
    * catch all of critical errors from process that occurs inside
    * of a child_process(executes gulp task to rebuild single file)
    */
   processErrorEmit() {
      this.childProcess.stderr.on('data', (data) => {
         logger.debug(data.toString());
      });
   }

   /**
    * Post processing results of single file gulp task execution.
    * Logs all errors/warning if it's occurred
    * @param resolve
    * @param reject
    */
   processResult(resolve, reject) {
      this.childProcess.on('exit', (code, signal) => {
         if (signal === 'SIGTERM') {
            logger.info('watcher has been terminated');
            reject();
         } else {
            if (this.hasErrors) {
               logger.info(`watcher: build was completed with these errors:\n${this.errors.join('\n')}`);
            }
            if (this.hasWarnings > 0) {
               logger.info(`watcher: build was completed with these warnings:\n${this.errors.join('\n')}`);
            }
            if (!this.hasErrors) {
               logger.info(`watcher: file ${this.filePath} has been built successfully!`);
            }
            resolve();
         }
      });
   }

   // run single file gulp task for current file
   execute(filePath) {
      this.filePath = filePath;
      logger.info(`watcher: start file ${filePath} build!`);
      this.childProcess = exec(
         `node node_modules/gulp/bin/gulp buildOnChange --config="${processParameters.config}" --nativeWatcher=true --filePath="${this.filePath}"`,
         processOptions
      );
      this.processOutputEmit();
      this.processErrorEmit();

      return new Promise((resolve, reject) => {
         this.processResult(resolve, reject);
      });
   }
}

// gets folder for native gulp watcher corresponding to the gulp_config
function getFolderForWatcher() {
   // get processed and parsed gulp config to get proper absolute path to builder cache
   const gulpConfig = ConfigurationReader.readConfigFileSync(processParameters.config, process.cwd());
   return `${gulpConfig.cache}/temp-modules`;
}

module.exports = {
   WatcherTask,
   getFolderForWatcher
};
