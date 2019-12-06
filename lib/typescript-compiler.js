/**
 * Основная библиотека для поиска ошибок typescript-компилятора в текущем проекте(с
 * помощью команды tsc --noEmit). Используется в основной задаче Gulp - build.
 * builder/gulp/builder/generate-workflow.js
 * @author Колбешин Ф.А.
 */

'use strict';

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const path = require('path');
const fs = require('fs-extra');
const logger = require('./logger').logger();
const TRUSTED_ERRORS = require('./typescript-trusted-errors.json');

async function runCompilerAndCheckForErrors(sourceDirectory) {
   const processOptions = {
      maxBuffer: 1024 * 500,
      cwd: sourceDirectory
   };

   // process.getegid is not available on windows or android, set it only for nix systems
   if (process.getegid) {
      processOptions.gid = process.getegid();
      processOptions.uid = process.geteuid();
   }

   /**
    * Prepare project directory for tsc command execute - copy typescript config
    * files from saby-typescript for proper "tsc" command execute. Get saby-typescript
    * workspace properly:
    * 1)saby-typescript as npm package of builder
    * 2)saby-typescript and builder has the same directory
    */
   let sabyTypescriptDirectory;
   if (await fs.pathExists(path.join(process.cwd(), '../saby-typescript'))) {
      sabyTypescriptDirectory = path.join(process.cwd(), '../saby-typescript');
   } else {
      sabyTypescriptDirectory = path.join(process.cwd(), 'node_modules/saby-typescript');
   }

   await fs.ensureSymlink(path.join(sabyTypescriptDirectory, 'configs/es5.json'), path.join(sourceDirectory, 'tsconfig.json'));
   await fs.ensureSymlink(path.join(sabyTypescriptDirectory, 'tslib.js'), path.join(sourceDirectory, 'tslib.js'));
   await fs.ensureSymlink(path.join(sabyTypescriptDirectory, 'tslint/index.json'), path.join(sourceDirectory, 'tslint.json'));

   /**
    * symlink also node_modules from builder to current project.
    * tsconfig requires types definition module(node_modules/@types) to be defined in current project node_modules.
    */
   await fs.ensureSymlink(path.join(process.cwd(), 'node_modules'), path.join(sourceDirectory, 'node_modules'));

   let result;
   try {
      await exec(`node ${sabyTypescriptDirectory}/cli.js --compiler --noEmit`, processOptions);
      logger.info('TypeScript compilation was completed successfully!');
      result = [];
   } catch (error) {
      result = error.stdout.split('\n').filter(currentError => !!currentError && !String(currentError).startsWith('  '));
   }
   await clearWorkspaceFromTsConfig(sourceDirectory);
   return result.map(currentError => currentError.replace(/\r/g, ''));
}

async function clearWorkspaceFromTsConfig(sourceDirectory) {
   await fs.remove(path.join(sourceDirectory, 'tsconfig.json'));
   await fs.remove(path.join(sourceDirectory, 'tslib.js'));
   await fs.remove(path.join(sourceDirectory, 'tslint.json'));
   await fs.remove(path.join(sourceDirectory, 'node_modules'));
}

async function typescriptCompiler(taskParameters) {
   const sourceDirectory = path.join(taskParameters.config.cachePath, 'temp-modules');
   const tsErrors = await runCompilerAndCheckForErrors(sourceDirectory);
   if (tsErrors.length > 0) {
      let overallLevel = 'info';
      tsErrors.forEach((currentError) => {
         const moduleInfo = taskParameters.config.modules.find(
            currentModule => currentModule.name === currentError.split('/').shift()
         );

         // Its wide skip without concrete error check, probably all of interface module files
         let itsWide = false;


         let level = currentError.includes('distrib/builder/node_modules/') || TRUSTED_ERRORS.some((message) => {
            const itsTrusted = currentError.startsWith(message);
            if (itsTrusted) {
               itsWide = !message.includes(': error TS') &&
                  !currentError.includes('Controls/_input/InputCallback/hoursFormat.ts(11,94): error TS1005');
            }
            return itsTrusted;
         }) ? 'info' : 'error';

         // Don't pass any critical syntax errors marked as 'TS1005' or 'TS1068'
         if (level === 'info' &&
            itsWide &&
            (currentError.includes(': error TS1005') || currentError.includes('error TS1068:'))
         ) {
            level = 'error';
         }

         if (level === 'error') {
            overallLevel = 'error';
         }

         /**
          * log as debug errors in Sbis Plugin because of problem with tsc configuration
          * TODO remove it after task completion
          * https://online.sbis.ru/opendoc.html?guid=77afe3f3-e22e-46ce-8355-6f73c135f2e9
          */
         if (taskParameters.config.isSbisPlugin) {
            logger.debug({
               message: currentError,
               moduleInfo
            });
         } else if (level === 'error') {
            logger[level]({
               message: currentError,
               moduleInfo
            });
         }
      });
      const tsCompletedMessage = 'TypeScript compilation was completed with errors. Check logs for details.';
      if (taskParameters.config.isSbisPlugin) {
         logger.debug(tsCompletedMessage);
      } else {
         logger[overallLevel](tsCompletedMessage);
      }
   }
}

module.exports = {
   runCompilerAndCheckForErrors,
   typescriptCompiler
};
