/**
 * Generates a workflow to run typescript compiler for current project
 * @author Kolbeshin F.A.
 */

'use strict';

const Cache = require('./classes/cache');
const Configuration = require('./classes/configuration.js');
const TaskParameters = require('../common/classes/task-parameters');
const { typescriptCompiler } = require('../../lib/typescript-compiler');

/**
 *
 * Generates a workflow to run typescript compiler for current project
 * @param processArgv - arguments of current running utility
 * @returns {function(): (Promise<void>|*)}
 */
function generateBuildWorkflowTypescript(processArgv) {
   // загрузка конфигурации должна быть синхронной, иначе не построятся задачи для сборки модулей
   const config = new Configuration();
   config.loadSync(processArgv);

   const taskParameters = new TaskParameters(config, new Cache(config));

   return generateTaskForTypescriptCompile(taskParameters);
}

function generateTaskForTypescriptCompile(taskParameters) {
   return function runTypescriptCompiler() {
      return typescriptCompiler(taskParameters);
   };
}

module.exports = generateBuildWorkflowTypescript;
