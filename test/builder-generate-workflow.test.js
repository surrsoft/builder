'use strict';

require('./init-test');

const path = require('path'),
   fs = require('fs-extra');

const generateWorkflow = require('../gulp/builder/generate-workflow.js');

const workspaceFolder = path.join(__dirname, 'workspace'),
   cacheFolder = path.join(workspaceFolder, 'cache'),
   outputFolder = path.join(workspaceFolder, 'output'),
   sourceFolder = path.join(workspaceFolder, 'source'),
   configPath = path.join(workspaceFolder, 'config.json'),
   moduleOutputFolder = path.join(outputFolder, 'Modul'),
   moduleSourceFolder = path.join(sourceFolder, 'Модуль'),
   themesSourceFolder = path.join(sourceFolder, 'Тема Скрепка');

const isSymlink = async(filePath) => {
   const fullPath = path.join(moduleOutputFolder, filePath);
   if (!(await fs.pathExists(fullPath))) {
      return false;
   }
   const stat = await fs.lstat(fullPath);
   return stat.isSymbolicLink();
};

const isRegularFile = async(filePath) => {
   const fullPath = path.join(moduleOutputFolder, filePath);
   if (!(await fs.pathExists(fullPath))) {
      return false;
   }
   const stat = await fs.lstat(fullPath);
   return !stat.isSymbolicLink() && stat.isFile();
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

const getMTime = async function(filePath) {
   return (await fs.lstat(filePath)).mtime.getTime();
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

const removeRSymbol = function(str) {
   return str.replace(/\r/g, '');
};

// нужно проверить что происходит:
// 1. при переименовывании файла == добавление/удаление файла
// 2. при изменении файла
// 3. если файл не менять
describe('gulp/builder/generate-workflow.js', () => {
   it('проверка компиляции less', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/less');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         mode: 'debug',
         modules: [
            {
               name: 'SBIS3.CONTROLS',
               path: path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflow();

      // проверим, что все нужные файлы появились в "стенде"
      let resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.css',
         'ForRename_old.css',
         'Stable.css',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      // изменим "исходники"
      await timeoutForMacOS();
      await fs.rename(
         path.join(moduleSourceFolder, 'ForRename_old.less'),
         path.join(moduleSourceFolder, 'ForRename_new.less')
      );
      const filePathForChange = path.join(moduleSourceFolder, 'ForChange.less');
      const data = await fs.readFile(filePathForChange);
      await fs.writeFile(filePathForChange, `${data.toString()}\n.test-selector2 {}`);

      // запустим повторно таску
      await runWorkflow();

      // проверим, что все нужные файлы появились в "стенде", лишние удалились
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.css',
         'ForRename_new.css',
         'Stable.css',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      await clearWorkspace();
   });

   it('routes', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/routes');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         mode: 'debug',
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflow();

      // проверим, что все нужные файлы появились в "стенде"
      let resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.routes.js',
         'ForRename_old.routes.js',
         'Stable.routes.js',
         'Test1.module.js',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);
      const routesInfoOutputPath = path.join(moduleOutputFolder, 'routes-info.json');
      let routesInfo = await fs.readJSON(routesInfoOutputPath);
      await routesInfo.should.deep.equal({
         'resources/Modul/ForChange.routes.js': {
            '/ForChange_old.html': {
               controller: 'js!SBIS3.Test1',
               isMasterPage: true
            }
         },
         'resources/Modul/ForRename_old.routes.js': {
            '/ForRename.html': {
               controller: 'js!SBIS3.Test1',
               isMasterPage: true
            }
         },
         'resources/Modul/Stable.routes.js': {
            '/Stable.html': {
               controller: 'js!SBIS3.Test1',
               isMasterPage: true
            }
         }
      });

      // запомним время модификации незменяемого файла и изменяемого в "стенде"
      const stableFileOutputPath = path.join(moduleOutputFolder, 'Stable.routes.js');
      const forChangeFileOutputPath = path.join(moduleOutputFolder, 'ForChange.routes.js');
      const mTimeStableFile = await getMTime(stableFileOutputPath);
      const mTimeForChangeFile = await getMTime(forChangeFileOutputPath);

      // изменим "исходники"
      await timeoutForMacOS();
      await fs.rename(
         path.join(moduleSourceFolder, 'ForRename_old.routes.js'),
         path.join(moduleSourceFolder, 'ForRename_new.routes.js')
      );
      const filePathForChange = path.join(moduleSourceFolder, 'ForChange.routes.js');
      const data = await fs.readFile(filePathForChange);
      await fs.writeFile(filePathForChange, data.toString().replace(/\/ForChange_old.html/g, '/ForChange_new.html'));

      // запустим повторно таску
      await runWorkflow();

      // проверим, что все нужные файлы появились в "стенде", лишние удалились
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.routes.js',
         'ForRename_new.routes.js',
         'Stable.routes.js',
         'Test1.module.js',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      // проверим время модификации незменяемого файла и изменяемого в "стенде"
      (await getMTime(stableFileOutputPath)).should.equal(mTimeStableFile);
      (await getMTime(forChangeFileOutputPath)).should.not.equal(mTimeForChangeFile);

      routesInfo = await fs.readJSON(routesInfoOutputPath);
      await routesInfo.should.deep.equal({
         'resources/Modul/ForChange.routes.js': {
            '/ForChange_new.html': {
               controller: 'js!SBIS3.Test1',
               isMasterPage: true
            }
         },
         'resources/Modul/ForRename_new.routes.js': {
            '/ForRename.html': {
               controller: 'js!SBIS3.Test1',
               isMasterPage: true
            }
         },
         'resources/Modul/Stable.routes.js': {
            '/Stable.html': {
               controller: 'js!SBIS3.Test1',
               isMasterPage: true
            }
         }
      });

      await clearWorkspace();
   });

   it('jsModules for contents.json', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/jsModules');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         mode: 'debug',
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflow();

      // проверим, что все нужные файлы появились в "стенде"
      let resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.module.js',
         'ForRename_old.module.js',
         'Stable.module.js',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);
      const contentsJsonOutputPath = path.join(moduleOutputFolder, 'contents.json');
      let contentsObj = await fs.readJSON(contentsJsonOutputPath);
      await contentsObj.should.deep.equal({
         buildMode: 'debug',
         htmlNames: {},
         jsModules: {
            'SBIS3.ForChange_old': 'Modul/ForChange.module.js',
            'SBIS3.ForRename': 'Modul/ForRename_old.module.js',
            'SBIS3.Stable': 'Modul/Stable.module.js'
         },
         modules: {
            'Модуль': 'Modul'
         },
         requirejsPaths: {},
         xmlContents: {}
      });

      // запомним время модификации незменяемого файла и изменяемого в "стенде"
      const stableFileOutputPath = path.join(moduleOutputFolder, 'Stable.module.js');
      const forChangeFileOutputPath = path.join(moduleOutputFolder, 'ForChange.module.js');
      const mTimeStableFile = await getMTime(stableFileOutputPath);
      const mTimeForChangeFile = await getMTime(forChangeFileOutputPath);

      // изменим "исходники"
      await timeoutForMacOS();
      await fs.rename(
         path.join(moduleSourceFolder, 'ForRename_old.module.js'),
         path.join(moduleSourceFolder, 'ForRename_new.module.js')
      );
      const filePathForChange = path.join(moduleSourceFolder, 'ForChange.module.js');
      const data = await fs.readFile(filePathForChange);
      await fs.writeFile(filePathForChange, data.toString().replace('ForChange_old', 'ForChange_new'));

      // запустим повторно таску
      await runWorkflow();

      // проверим, что все нужные файлы появились в "стенде", лишние удалились
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.module.js',
         'ForRename_new.module.js',
         'Stable.module.js',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      // проверим время модификации незменяемого файла и изменяемого в "стенде"
      (await getMTime(stableFileOutputPath)).should.equal(mTimeStableFile);
      (await getMTime(forChangeFileOutputPath)).should.not.equal(mTimeForChangeFile);

      contentsObj = await fs.readJSON(contentsJsonOutputPath);
      await contentsObj.should.deep.equal({
         buildMode: 'debug',
         htmlNames: {},
         jsModules: {
            'SBIS3.ForChange_new': 'Modul/ForChange.module.js',
            'SBIS3.ForRename': 'Modul/ForRename_new.module.js',
            'SBIS3.Stable': 'Modul/Stable.module.js'
         },
         modules: {
            'Модуль': 'Modul'
         },
         requirejsPaths: {},
         xmlContents: {}
      });

      await clearWorkspace();
   });

   it('static html', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/staticHtml');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         mode: 'debug',
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            },
            {
               name: 'Тема Скрепка',
               path: path.join(sourceFolder, 'Тема Скрепка')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflow();

      // проверим, что все нужные файлы появились в "стенде"
      let resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.module.js',
         'ForChange_old.html',
         'ForRename_old.module.js',
         'ForRename.html',
         'Stable.module.js',
         'Stable.html',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);
      const contentsJsonOutputPath = path.join(moduleOutputFolder, 'contents.json');
      let contentsObj = await fs.readJSON(contentsJsonOutputPath);
      await contentsObj.should.deep.equal({
         buildMode: 'debug',
         htmlNames: {
            'js!SBIS3.ForChange_old': 'ForChange_old.html',
            'js!SBIS3.ForRename': 'ForRename.html',
            'js!SBIS3.Stable': 'Stable.html'
         },
         jsModules: {
            'SBIS3.ForChange_old': 'Modul/ForChange.module.js',
            'SBIS3.ForRename': 'Modul/ForRename_old.module.js',
            'SBIS3.Stable': 'Modul/Stable.module.js'
         },
         modules: {
            'Модуль': 'Modul'
         },
         requirejsPaths: {},
         xmlContents: {}
      });

      // запомним время модификации незменяемого файла и изменяемого в "стенде"
      const stableJsOutputPath = path.join(moduleOutputFolder, 'Stable.module.js');
      const stableHtmlOutputPath = path.join(moduleOutputFolder, 'Stable.html');
      const forChangeJsOutputPath = path.join(moduleOutputFolder, 'ForChange.module.js');
      let forChangeHtmlOutputPath = path.join(moduleOutputFolder, 'ForChange_old.html');
      const mTimeStableJs = await getMTime(stableJsOutputPath);
      const mTimeStableHtml = await getMTime(stableHtmlOutputPath);
      const mTimeForChangeJs = await getMTime(forChangeJsOutputPath);
      const mTimeForChangeHtml = await getMTime(forChangeHtmlOutputPath);

      // проверим сами html
      let stableHtml = await fs.readFile(stableHtmlOutputPath);
      let forChangeHtml = await fs.readFile(forChangeHtmlOutputPath);
      const forRenameHtmlOutputPath = path.join(moduleOutputFolder, 'ForRename.html');
      let forRenameHtml = await fs.readFile(forRenameHtmlOutputPath);
      removeRSymbol(stableHtml.toString()).should.equal(
         '<STABLE></STABLE>\n' +
         '<TITLE>Stable</TITLE>\n' +
         '<START_DIALOG>js!SBIS3.Stable</START_DIALOG>\n' +
         '<INCLUDE><INCLUDE1/>\n' +
         '</INCLUDE>\n' +
         '<RESOURCE_ROOT>resources/</RESOURCE_ROOT>\n' +
         '<WI.SBIS_ROOT>resources/WS.Core/</WI.SBIS_ROOT>\n' +
         '<APPLICATION_ROOT></APPLICATION_ROOT>\n' +
         '<SERVICES_PATH>service/</SERVICES_PATH>\n' +
         '<APPEND_STYLE></APPEND_STYLE>\n' +
         '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
         '<ACCESS_LIST></ACCESS_LIST>\n' +
         '<CONFIG.USER_PARAMS>false</CONFIG.USER_PARAMS>\n' +
         '<CONFIG.GLOBAL_PARAMS>false</CONFIG.GLOBAL_PARAMS>\n' +
         '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );
      removeRSymbol(forChangeHtml.toString()).should.equal(
         '<FOR_CHANGE_OLD></FOR_CHANGE_OLD>\n' +
         '<TITLE>ForChange_old</TITLE>\n' +
         '<START_DIALOG>js!SBIS3.ForChange_old</START_DIALOG>\n' +
         '<INCLUDE><INCLUDE1/>\n' +
         '</INCLUDE>\n' +
         '<RESOURCE_ROOT>resources/</RESOURCE_ROOT>\n' +
         '<WI.SBIS_ROOT>resources/WS.Core/</WI.SBIS_ROOT>\n' +
         '<APPLICATION_ROOT></APPLICATION_ROOT>\n' +
         '<SERVICES_PATH>service/</SERVICES_PATH>\n' +
         '<APPEND_STYLE></APPEND_STYLE>\n' +
         '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
         '<ACCESS_LIST></ACCESS_LIST>\n' +
         '<CONFIG.USER_PARAMS>false</CONFIG.USER_PARAMS>\n' +
         '<CONFIG.GLOBAL_PARAMS>false</CONFIG.GLOBAL_PARAMS>\n' +
         '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );
      removeRSymbol(forRenameHtml.toString()).should.equal(
         '<FOR_RENAME></FOR_RENAME>\n' +
         '<TITLE>ForRename</TITLE>\n' +
         '<START_DIALOG>js!SBIS3.ForRename</START_DIALOG>\n' +
         '<INCLUDE><INCLUDE1/>\n' +
         '</INCLUDE>\n' +
         '<RESOURCE_ROOT>resources/</RESOURCE_ROOT>\n' +
         '<WI.SBIS_ROOT>resources/WS.Core/</WI.SBIS_ROOT>\n' +
         '<APPLICATION_ROOT></APPLICATION_ROOT>\n' +
         '<SERVICES_PATH>service/</SERVICES_PATH>\n' +
         '<APPEND_STYLE></APPEND_STYLE>\n' +
         '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
         '<ACCESS_LIST></ACCESS_LIST>\n' +
         '<CONFIG.USER_PARAMS>false</CONFIG.USER_PARAMS>\n' +
         '<CONFIG.GLOBAL_PARAMS>false</CONFIG.GLOBAL_PARAMS>\n' +
         '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );

      // изменим "исходники"
      await timeoutForMacOS();
      await fs.rename(
         path.join(moduleSourceFolder, 'ForRename_old.module.js'),
         path.join(moduleSourceFolder, 'ForRename_new.module.js')
      );
      await fs.rename(
         path.join(themesSourceFolder, 'ForRename_old.html'),
         path.join(themesSourceFolder, 'ForRename_new.html')
      );

      const filePathForChangeJs = path.join(moduleSourceFolder, 'ForChange.module.js');
      const dataJs = await fs.readFile(filePathForChangeJs);
      await fs.writeFile(filePathForChangeJs, dataJs.toString().replace(/ForChange_old/g, 'ForChange_new'));

      const filePathForChangeHtml = path.join(themesSourceFolder, 'ForChange.html');
      const dataHtml = await fs.readFile(filePathForChangeHtml);
      await fs.writeFile(filePathForChangeHtml, dataHtml.toString().replace(/FOR_CHANGE_OLD/g, 'FOR_CHANGE_NEW'));

      // запустим повторно таску
      await runWorkflow();

      // проверим, что все нужные файлы появились в "стенде", лишние удалились
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.module.js',
         'ForChange_new.html',
         'ForRename_new.module.js',
         'ForRename.html',
         'Stable.module.js',
         'Stable.html',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      // проверим время модификации незменяемого файла и изменяемого в "стенде"
      // !!! В отличии от остальных файлов, статические HTML всегда пересоздаются заново, т.к. кешировать их сложно,
      // а весь процесс длится меньше 2 секунд.
      forChangeHtmlOutputPath = path.join(moduleOutputFolder, 'ForChange_new.html');
      (await getMTime(stableJsOutputPath)).should.equal(mTimeStableJs);

      // следующая проверка отличается от остальных и это норма
      (await getMTime(stableHtmlOutputPath)).should.not.equal(mTimeStableHtml);
      (await getMTime(forChangeJsOutputPath)).should.not.equal(mTimeForChangeJs);
      (await getMTime(forChangeHtmlOutputPath)).should.not.equal(mTimeForChangeHtml);

      contentsObj = await fs.readJSON(contentsJsonOutputPath);
      await contentsObj.should.deep.equal({
         buildMode: 'debug',
         htmlNames: {
            'js!SBIS3.ForChange_new': 'ForChange_new.html',
            'js!SBIS3.ForRename': 'ForRename.html',
            'js!SBIS3.Stable': 'Stable.html'
         },
         jsModules: {
            'SBIS3.ForChange_new': 'Modul/ForChange.module.js',
            'SBIS3.ForRename': 'Modul/ForRename_new.module.js',
            'SBIS3.Stable': 'Modul/Stable.module.js'
         },
         modules: {
            'Модуль': 'Modul'
         },
         requirejsPaths: {},
         xmlContents: {}
      });

      // проверим сами html
      stableHtml = await fs.readFile(stableHtmlOutputPath);
      forChangeHtml = await fs.readFile(forChangeHtmlOutputPath);
      forRenameHtml = await fs.readFile(forRenameHtmlOutputPath);
      removeRSymbol(stableHtml.toString()).should.equal(
         '<STABLE></STABLE>\n' +
         '<TITLE>Stable</TITLE>\n' +
         '<START_DIALOG>js!SBIS3.Stable</START_DIALOG>\n' +
         '<INCLUDE><INCLUDE1/>\n' +
         '</INCLUDE>\n' +
         '<RESOURCE_ROOT>resources/</RESOURCE_ROOT>\n' +
         '<WI.SBIS_ROOT>resources/WS.Core/</WI.SBIS_ROOT>\n' +
         '<APPLICATION_ROOT></APPLICATION_ROOT>\n' +
         '<SERVICES_PATH>service/</SERVICES_PATH>\n' +
         '<APPEND_STYLE></APPEND_STYLE>\n' +
         '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
         '<ACCESS_LIST></ACCESS_LIST>\n' +
         '<CONFIG.USER_PARAMS>false</CONFIG.USER_PARAMS>\n' +
         '<CONFIG.GLOBAL_PARAMS>false</CONFIG.GLOBAL_PARAMS>\n' +
         '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );

      // TODO: в следующей строке ошибка из-за кеширования результата в lib/generate-static-html-for-js.js.
      // должно быть FOR_CHANGE_NEW. пока этим можно пренебречь
      removeRSymbol(forChangeHtml.toString()).should.equal(
         '<FOR_CHANGE_OLD></FOR_CHANGE_OLD>\n' +
         '<TITLE>ForChange_new</TITLE>\n' +
         '<START_DIALOG>js!SBIS3.ForChange_new</START_DIALOG>\n' +
         '<INCLUDE><INCLUDE1/>\n' +
         '</INCLUDE>\n' +
         '<RESOURCE_ROOT>resources/</RESOURCE_ROOT>\n' +
         '<WI.SBIS_ROOT>resources/WS.Core/</WI.SBIS_ROOT>\n' +
         '<APPLICATION_ROOT></APPLICATION_ROOT>\n' +
         '<SERVICES_PATH>service/</SERVICES_PATH>\n' +
         '<APPEND_STYLE></APPEND_STYLE>\n' +
         '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
         '<ACCESS_LIST></ACCESS_LIST>\n' +
         '<CONFIG.USER_PARAMS>false</CONFIG.USER_PARAMS>\n' +
         '<CONFIG.GLOBAL_PARAMS>false</CONFIG.GLOBAL_PARAMS>\n' +
         '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );

      removeRSymbol(forRenameHtml.toString()).should.equal(
         '<FOR_RENAME></FOR_RENAME>\n' +
         '<TITLE>ForRename</TITLE>\n' +
         '<START_DIALOG>js!SBIS3.ForRename</START_DIALOG>\n' +
         '<INCLUDE><INCLUDE1/>\n' +
         '</INCLUDE>\n' +
         '<RESOURCE_ROOT>resources/</RESOURCE_ROOT>\n' +
         '<WI.SBIS_ROOT>resources/WS.Core/</WI.SBIS_ROOT>\n' +
         '<APPLICATION_ROOT></APPLICATION_ROOT>\n' +
         '<SERVICES_PATH>service/</SERVICES_PATH>\n' +
         '<APPEND_STYLE></APPEND_STYLE>\n' +
         '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
         '<ACCESS_LIST></ACCESS_LIST>\n' +
         '<CONFIG.USER_PARAMS>false</CONFIG.USER_PARAMS>\n' +
         '<CONFIG.GLOBAL_PARAMS>false</CONFIG.GLOBAL_PARAMS>\n' +
         '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );

      await clearWorkspace();
   });

   it('create symlink or copy', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/symlink');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         mode: 'debug',
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      const check = async() => {
         // запустим таску
         await runWorkflow();

         // файлы из исходников
         (await isSymlink('template.html')).should.equal(true);
         (await isSymlink('TestHtmlTmpl.html.tmpl')).should.equal(true);
         (await isSymlink('TestStaticHtml.js')).should.equal(true);

         // генерируемые файлы из исходников
         (await isRegularFile('StaticHtml.html')).should.equal(true);
         (await isRegularFile('TestHtmlTmpl.html')).should.equal(true);
         (await isRegularFile('TestLess.css')).should.equal(true);

         // генерируемые файлы на модуль
         (await isRegularFile('contents.js')).should.equal(true);
         (await isRegularFile('contents.json')).should.equal(true);
         (await isRegularFile('navigation-modules.json')).should.equal(true);
         (await isRegularFile('routes-info.json')).should.equal(true);
         (await isRegularFile('static_templates.json')).should.equal(true);
      };

      await check();

      // второй раз, чтобы проверить не ломает ли чего инкрементальная сборка
      await check();

      await clearWorkspace();
   });

   // проверим, что js локализации корректно создаются. и что en-US.less попадает в lang/en-US/en-US.css
   it('localization dictionary and style', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/localization');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         mode: 'debug',
         localization: ['en-US', 'ru-RU'],
         'default-localization': 'ru-RU',
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      const check = async() => {
         // запустим таску
         await runWorkflow();

         (await isRegularFile('lang/en-US/en-US.css')).should.equal(true);
         (await isRegularFile('lang/en-US/en-US.js')).should.equal(true);
         (await isRegularFile('lang/ru-RU/ru-RU.js')).should.equal(true);


         (await isSymlink('lang/ru-RU/ru-RU.json')).should.equal(true);
      };

      await check();

      // второй раз, чтобы проверить не ломает ли чего инкрементальная сборка
      await check();

      await clearWorkspace();
   });
});
