/* eslint-disable global-require */
'use strict';

const path = require('path'),
   fs = require('fs-extra');

function copyWS() {
   const nodeModulesPath = path.normalize(path.join(__dirname, '../node_modules'));
   const fixtureWSPath = path.join(__dirname, 'fixtureWS');
   const prepareWS = require('../gulp/common/generate-task/prepare-ws.js');
   const ModuleInfo = require('../gulp/common/classes/base-module-info');
   const TaskParameters = require('../gulp/common/classes/task-parameters');
   const Config = require('../gulp/builder/classes/configuration');

   fs.removeSync(fixtureWSPath);

   /* fs.copySync(path.join(nodeModulesPath, 'sbis3-ws/ws'), path.join(fixtureWSPath, 'WS.Core'));
   fs.copySync(path.join(nodeModulesPath, 'sbis3-ws/Core'), path.join(fixtureWSPath, 'Core'));
   fs.copySync(path.join(nodeModulesPath, 'sbis3-ws/View'), path.join(fixtureWSPath, 'View'));
   fs.copySync(path.join(nodeModulesPath, 'sbis3-controls/Controls'), path.join(fixtureWSPath, 'Controls'));
*/
   const config = new Config();
   config.cachePath = fixtureWSPath;
   config.modules = [
      new ModuleInfo('ws', '', path.join(nodeModulesPath, 'sbis3-ws/ws')),
      new ModuleInfo('Core', '', path.join(nodeModulesPath, 'sbis3-ws/Core')),
      new ModuleInfo('View', '', path.join(nodeModulesPath, 'sbis3-ws/View')),
      new ModuleInfo('Controls', '', path.join(nodeModulesPath, 'sbis3-controls/Controls'))
   ];
   const taskParameters = new TaskParameters(config, null);
   return new Promise((resolve) => {
      prepareWS(taskParameters)(resolve);
   });
}


process.on('unhandledRejection', (reason, p) => {
   // eslint-disable-next-line no-console
   console.log(
      "[00:00:00] [ERROR] Критическая ошибка в работе builder'а. ",
      'Unhandled Rejection at:\n',
      p,
      '\nreason:\n',
      reason
   );
});


let initialized = false;

async function init() {
   if (!initialized) {
      try {
         // TODO: разобраться почему объявление gulp после WS не работает
         require('gulp');


         // логгер - глобальный, должен быть определён до инициализации WS
         require('../lib/logger').setGulpLogger();

         const chai = require('chai'),
            chaiAsPromised = require('chai-as-promised');

         chai.use(chaiAsPromised);
         chai.should();

         await copyWS();
         process.env['ws-core-path'] = path.join(__dirname, 'fixtureWS/platform/ws');
         require('../gulp/common/node-ws').init();
         initialized = true;
      } catch (e) {
         // eslint-disable-next-line no-console
         console.log(`[00:00:00] [ERROR] Исключение при инициализации тестов: ${e.message}`);
         // eslint-disable-next-line no-console
         console.log(`Stack: ${e.stack}`);
         process.exit(1);
      }
   }
}

module.exports = init;
