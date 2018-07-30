'use strict';

const initTest = require('./init-test');

const path = require('path'),
   fs = require('fs-extra');

const generateWorkflow = require('../gulp/grabber/generate-workflow.js');

const workspaceFolder = path.join(__dirname, 'workspace'),
   cacheFolder = path.join(workspaceFolder, 'cache'),
   sourceFolder = path.join(workspaceFolder, 'source'),
   configPath = path.join(workspaceFolder, 'config.json'),
   outputJson = path.join(workspaceFolder, 'output.json'),
   moduleSourceFolder = path.join(sourceFolder, 'Модуль');

const config = {
   cache: cacheFolder,
   output: outputJson,
   modules: [
      {
         name: 'Модуль',
         path: path.join(sourceFolder, 'Модуль')
      }
   ]
};

const clearWorkspace = function() {
   return fs.remove(workspaceFolder);
};

const prepareTest = async function(fixtureFolder) {
   await clearWorkspace();
   await fs.ensureDir(sourceFolder);
   await fs.copy(fixtureFolder, sourceFolder);
};

const runWorkflow = function() {
   return new Promise((resolve) => {
      generateWorkflow([`--config="${configPath}"`])(resolve);
   });
};

const timeout = function(ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
};

// в файловой системе HFS Plus точность хранения даты равняется 1 секунде
// из-за этого тесты могуть падать непредсказуемым образом, и при этом для пользователя проблем не будет
const timeoutForMacOS = async function() {
   if (process.platform === 'darwin') {
      await timeout(1000);
   }
};

// все тесты по сути завязаны на значение контекста(context) одной фразы в файле Component.<extension>
const checkResult = async function(extension, context) {
   const resultObj = await fs.readJSON(outputJson);
   resultObj.length.should.equals(1);
   resultObj[0].key.should.equals('AnyText');
   resultObj[0].context.should.equals(context);
   resultObj[0].ui.should.equals(moduleSourceFolder);
   resultObj[0].module.should.equals(path.join(moduleSourceFolder, `Component.${extension}`));
};

// нужно проверить что происходить, что кеш работает
describe('gulp/grabber/generate-workflow.js', () => {
   before(async() => {
      await initTest();
   });

   describe('проверка сбора фраз локализации по js коду', () => {
      it('перезапуск без изменений', async() => {
         const fixtureFolder = path.join(__dirname, 'fixture/grabber-generate-workflow/javascript');
         await prepareTest(fixtureFolder);
         await fs.writeJSON(configPath, config);

         await runWorkflow();
         await checkResult('js', 'AnyContext');

         await runWorkflow();
         await checkResult('js', 'AnyContext');

         await clearWorkspace();
      });

      it('перезапуск с изменениями в исходниках', async() => {
         const fixtureFolder = path.join(__dirname, 'fixture/grabber-generate-workflow/javascript');
         await prepareTest(fixtureFolder);
         await fs.writeJSON(configPath, config);

         await runWorkflow();
         await checkResult('js', 'AnyContext');

         await timeoutForMacOS();
         const testFilePath = path.join(sourceFolder, 'Модуль/Component.js');
         const testFileText = (await fs.readFile(testFilePath)).toString();
         await fs.writeFile(testFilePath, testFileText.replace('AnyContext', 'AnyContext123'));

         await runWorkflow();
         await checkResult('js', 'AnyContext123');

         await clearWorkspace();
      });

      it('перезапуск с изменениями в кеше', async() => {
         //
         const fixtureFolder = path.join(__dirname, 'fixture/grabber-generate-workflow/javascript');
         await prepareTest(fixtureFolder);
         await fs.writeJSON(configPath, config);

         await runWorkflow();
         await checkResult('js', 'AnyContext');

         await timeoutForMacOS();
         const cacheFilePath = path.join(cacheFolder, 'grabber-cache.json');
         const cacheFileText = (await fs.readFile(cacheFilePath)).toString();
         await fs.writeFile(cacheFilePath, cacheFileText.replace('AnyContext', 'AnyContext123'));

         await runWorkflow();
         await checkResult('js', 'AnyContext123');

         await clearWorkspace();
      });
   });

   describe('проверка сбора фраз локализации по xhtml коду', () => {
      it('перезапуск без изменений', async() => {
         const fixtureFolder = path.join(__dirname, 'fixture/grabber-generate-workflow/xhtml');
         await prepareTest(fixtureFolder);
         await fs.writeJSON(configPath, config);

         await runWorkflow();
         await checkResult('xhtml', 'AnyContext');

         await runWorkflow();
         await checkResult('xhtml', 'AnyContext');

         await clearWorkspace();
      });

      it('перезапуск с изменениями в xhtml', async() => {
         const fixtureFolder = path.join(__dirname, 'fixture/grabber-generate-workflow/xhtml');
         await prepareTest(fixtureFolder);
         await fs.writeJSON(configPath, config);

         await runWorkflow();
         await checkResult('xhtml', 'AnyContext');

         await timeoutForMacOS();
         const testFilePath = path.join(sourceFolder, 'Модуль/Component.xhtml');
         const testFileText = (await fs.readFile(testFilePath)).toString();
         await fs.writeFile(testFilePath, testFileText.replace('AnyContext', 'AnyContext123'));

         await runWorkflow();
         await checkResult('xhtml', 'AnyContext123');

         await clearWorkspace();
      });

      it('перезапуск с изменениями в кеше', async() => {
         //
         const fixtureFolder = path.join(__dirname, 'fixture/grabber-generate-workflow/xhtml');
         await prepareTest(fixtureFolder);
         await fs.writeJSON(configPath, config);

         await runWorkflow();
         await checkResult('xhtml', 'AnyContext');

         await timeoutForMacOS();
         const cacheFilePath = path.join(cacheFolder, 'grabber-cache.json');
         const cacheFileText = (await fs.readFile(cacheFilePath)).toString();
         await fs.writeFile(cacheFilePath, cacheFileText.replace('AnyContext', 'AnyContext123'));

         await runWorkflow();
         await checkResult('xhtml', 'AnyContext123');

         await clearWorkspace();
      });

      it('перезапуск с изменениями в js', async() => {
         // при 1-м и 3-м запуске в js есть @translatable, а при 2-м запуске - нет
         const fixtureFolder = path.join(__dirname, 'fixture/grabber-generate-workflow/xhtml');
         await prepareTest(fixtureFolder);
         await fs.writeJSON(configPath, config);

         await runWorkflow();
         await checkResult('xhtml', 'AnyContext');

         await timeoutForMacOS();
         const testFilePath = path.join(sourceFolder, 'Модуль/ComponentWithOption.js');
         const testFileText = (await fs.readFile(testFilePath)).toString();
         await fs.writeFile(testFilePath, testFileText.replace('@translatable', '@translatable123'));

         await runWorkflow();
         const resultObj = await fs.readJSON(outputJson);
         resultObj.length.should.equals(0);

         await timeoutForMacOS();
         await fs.writeFile(testFilePath, testFileText);

         await runWorkflow();
         await checkResult('xhtml', 'AnyContext');

         await clearWorkspace();
      });
   });

   describe('проверка сбора фраз локализации по tmpl коду', () => {
      it('перезапуск без изменений', async() => {
         const fixtureFolder = path.join(__dirname, 'fixture/grabber-generate-workflow/tmpl');
         await prepareTest(fixtureFolder);
         await fs.writeJSON(configPath, config);

         await runWorkflow();
         await checkResult('tmpl', 'AnyContext');

         await runWorkflow();
         await checkResult('tmpl', 'AnyContext');

         await clearWorkspace();
      });

      it('перезапуск с изменениями в tmpl', async() => {
         const fixtureFolder = path.join(__dirname, 'fixture/grabber-generate-workflow/tmpl');
         await prepareTest(fixtureFolder);
         await fs.writeJSON(configPath, config);

         await runWorkflow();
         await checkResult('tmpl', 'AnyContext');

         await timeoutForMacOS();
         const testFilePath = path.join(sourceFolder, 'Модуль/Component.tmpl');
         const testFileText = (await fs.readFile(testFilePath)).toString();
         await fs.writeFile(testFilePath, testFileText.replace('AnyContext', 'AnyContext123'));

         await runWorkflow();
         await checkResult('tmpl', 'AnyContext123');

         await clearWorkspace();
      });

      it('перезапуск с изменениями в кеше', async() => {
         //
         const fixtureFolder = path.join(__dirname, 'fixture/grabber-generate-workflow/tmpl');
         await prepareTest(fixtureFolder);
         await fs.writeJSON(configPath, config);

         await runWorkflow();
         await checkResult('tmpl', 'AnyContext');

         await timeoutForMacOS();
         const cacheFilePath = path.join(cacheFolder, 'grabber-cache.json');
         const cacheFileText = (await fs.readFile(cacheFilePath)).toString();
         await fs.writeFile(cacheFilePath, cacheFileText.replace('AnyContext', 'AnyContext123'));

         await runWorkflow();
         await checkResult('tmpl', 'AnyContext123');

         await clearWorkspace();
      });

      it('перезапуск с изменениями в js', async() => {
         // при 1-м и 3-м запуске в js есть @translatable, а при 2-м запуске - нет
         const fixtureFolder = path.join(__dirname, 'fixture/grabber-generate-workflow/tmpl');
         await prepareTest(fixtureFolder);
         await fs.writeJSON(configPath, config);

         await runWorkflow();
         await checkResult('tmpl', 'AnyContext');

         await timeoutForMacOS();
         const testFilePath = path.join(sourceFolder, 'Модуль/ComponentWithOption.js');
         const testFileText = (await fs.readFile(testFilePath)).toString();
         await fs.writeFile(testFilePath, testFileText.replace('@translatable', '@translatable123'));

         await runWorkflow();
         const resultObj = await fs.readJSON(outputJson);
         resultObj.length.should.equals(0);

         await timeoutForMacOS();
         await fs.writeFile(testFilePath, testFileText);

         await runWorkflow();
         await checkResult('tmpl', 'AnyContext');

         await clearWorkspace();
      });
   });
});
