'use strict';

require('./init-test');

const path = require('path'),
   fs = require('fs-extra');

const generateWorkflow = require('../gulp/grabber/generate-workflow.js');

const workspaceFolder = path.join(__dirname, 'workspace'),
   cacheFolder = path.join(workspaceFolder, 'cache'),
   sourceFolder = path.join(workspaceFolder, 'source'),
   configPath = path.join(workspaceFolder, 'config.json'),
   outputJson = path.join(workspaceFolder, 'output.json'),
   moduleSourceFolder = path.join(sourceFolder, 'Модуль');

const clearWorkspace = function() {
   return fs.remove(workspaceFolder);
};

const prepareTest = async function(fixtureFolder) {
   await clearWorkspace();
   await fs.ensureDir(sourceFolder);
   await fs.copy(fixtureFolder, sourceFolder);
};

const runWorkflow = function() {
   return new Promise(resolve => {
      generateWorkflow([`--config="${configPath}"`])(resolve);
   });
};

const getMTime = async function(filePath) {
   return (await fs.lstat(filePath)).mtime.getTime();
};

const timeout = function(ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
};

//в файловой системе HFS Plus точность хранения даты равняется 1 секунде
//из-за этого тесты могуть падать непредсказуемым образом, и при этом для пользователя проблем не будет
const timeoutForMacOS = async function() {
   if (process.platform === 'darwin') {
      await timeout(1000);
   }
};

//нужно проверить что происходит:
//1. при переименовывании файла == добавление/удаление файла
//2. при изменении файла
//3. если файл не менять
describe('gulp/grabber/generate-workflow.js', function() {
   this.timeout(4000); //eslint-disable-line no-invalid-this

   it('проверка сбора фраз локализации по js коду', async function() {
      const fixtureFolder = path.join(__dirname, 'fixture/grabber-generate-workflow/javascript');
      await prepareTest(fixtureFolder);

      const config = {
         'cache': cacheFolder,
         'output': outputJson,
         'modules': [
            {
               'name': 'Модуль',
               'path': path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      //запустим таску
      await runWorkflow();

      //проверим, что все нужные файлы правильно обработались
      let resultObj = await fs.readJSON(outputJson);

      //запомним время модификации незменяемого файла и изменяемого в "стенде"

      //изменим "исходники"
      await timeoutForMacOS();

      //запустим повторно таску
      await runWorkflow();

      //проверим, что все нужные файлы правильно обработались
      resultObj = await fs.readJSON(outputJson);

      //проверим время модификации незменяемого файла и изменяемого в "стенде"

      await clearWorkspace();
   });
});
