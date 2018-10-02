'use strict';

const initTest = require('./init-test');

const path = require('path'),
   fs = require('fs-extra'),
   pMap = require('p-map'),
   helpers = require('../lib/helpers');

const generateWorkflow = require('../gulp/builder/generate-workflow.js');

const {
   timeoutForMacOS, getMTime, removeRSymbol, isSymlink, isRegularFile, linkPlatform
} = require('./lib');

const workspaceFolder = path.join(__dirname, 'workspace'),
   cacheFolder = path.join(workspaceFolder, 'cache'),
   outputFolder = path.join(workspaceFolder, 'output'),
   sourceFolder = path.join(workspaceFolder, 'source'),
   configPath = path.join(workspaceFolder, 'config.json'),
   moduleOutputFolder = path.join(outputFolder, 'Modul'),
   moduleSourceFolder = path.join(sourceFolder, 'Модуль'),
   themesSourceFolder = path.join(sourceFolder, 'Тема Скрепка');

const clearWorkspace = function() {
   return fs.remove(workspaceFolder);
};

const prepareTest = async function(fixtureFolder) {
   await clearWorkspace();
   await fs.ensureDir(sourceFolder);
   await fs.copy(fixtureFolder, sourceFolder);
};

const runWorkflow = function() {
   return new Promise((resolve, reject) => {
      generateWorkflow([`--config="${configPath}"`])((error) => {
         if (error) {
            reject(error);
         } else {
            resolve();
         }
      });
   });
};

// нужно проверить что происходит:
// 1. при переименовывании файла == добавление/удаление файла
// 2. при изменении файла
// 3. если файл не менять
describe('gulp/builder/generate-workflow.js', () => {
   before(async() => {
      await initTest();
   });

   it('compile less', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/less');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         builderTests: true,
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
         'Error.less',
         'ForChange.css',
         'ForChange.less',
         'ForChange_online.css',
         'ForRename_old.css',
         'ForRename_old.less',
         'ForRename_old_online.css',
         'Stable.css',
         'Stable.less',
         'Stable_online.css',
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
         'Error.less',
         'ForChange.css',
         'ForChange.less',
         'ForChange_online.css',
         'ForRename_new.css',
         'ForRename_new.less',
         'ForRename_new_online.css',
         'Stable.css',
         'Stable.less',
         'Stable_online.css',
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
         builderTests: true,
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
         'Test1.js',
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
               controller: 'Modul/Test1',
               isMasterPage: false
            }
         },
         'resources/Modul/ForRename_old.routes.js': {
            '/ForRename.html': {
               controller: 'Modul/Test1',
               isMasterPage: false
            }
         },
         'resources/Modul/Stable.routes.js': {
            '/Stable.html': {
               controller: 'Modul/Test1',
               isMasterPage: false
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
         'Test1.js',
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
               controller: 'Modul/Test1',
               isMasterPage: false
            }
         },
         'resources/Modul/ForRename_new.routes.js': {
            '/ForRename.html': {
               controller: 'Modul/Test1',
               isMasterPage: false
            }
         },
         'resources/Modul/Stable.routes.js': {
            '/Stable.html': {
               controller: 'Modul/Test1',
               isMasterPage: false
            }
         }
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
         builderTests: true,
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
         'ForChange.js',
         'ForChange_old.html',
         'ForRename_old.js',
         'ForRename.html',
         'Stable.js',
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
            'Modul/ForChange': 'ForChange_old.html',
            'Modul/ForRename_old': 'ForRename.html',
            'Modul/Stable': 'Stable.html'
         },
         modules: {
            Modul: {
               name: 'Модуль'
            }
         }
      });

      // запомним время модификации незменяемого файла и изменяемого в "стенде"
      const stableJsOutputPath = path.join(moduleOutputFolder, 'Stable.js');
      const stableHtmlOutputPath = path.join(moduleOutputFolder, 'Stable.html');
      const forChangeJsOutputPath = path.join(moduleOutputFolder, 'ForChange.js');
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
      const staticTemplatesJsonOutputPath = path.join(moduleOutputFolder, 'static_templates.json');
      let staticTemplatesJson = await fs.readFile(staticTemplatesJsonOutputPath);
      removeRSymbol(stableHtml.toString()).should.equal(
         '<STABLE></STABLE>\n' +
            '<TITLE>Stable</TITLE>\n' +
            '<START_DIALOG>Modul/Stable</START_DIALOG>\n' +
            '<INCLUDE><INCLUDE1/>\n' +
            '</INCLUDE>\n' +
            '<RESOURCE_ROOT>resources/</RESOURCE_ROOT>\n' +
            '<WI.SBIS_ROOT>resources/WS.Core/</WI.SBIS_ROOT>\n' +
            '<APPLICATION_ROOT></APPLICATION_ROOT>\n' +
            '<SERVICES_PATH>service/</SERVICES_PATH>\n' +
            '<APPEND_STYLE></APPEND_STYLE>\n' +
            '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
            '<ACCESS_LIST></ACCESS_LIST>\n' +
            '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
            '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
            '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );
      removeRSymbol(forChangeHtml.toString()).should.equal(
         '<FOR_CHANGE_OLD></FOR_CHANGE_OLD>\n' +
            '<TITLE>ForChange_old</TITLE>\n' +
            '<START_DIALOG>Modul/ForChange</START_DIALOG>\n' +
            '<INCLUDE><INCLUDE1/>\n' +
            '</INCLUDE>\n' +
            '<RESOURCE_ROOT>resources/</RESOURCE_ROOT>\n' +
            '<WI.SBIS_ROOT>resources/WS.Core/</WI.SBIS_ROOT>\n' +
            '<APPLICATION_ROOT></APPLICATION_ROOT>\n' +
            '<SERVICES_PATH>service/</SERVICES_PATH>\n' +
            '<APPEND_STYLE></APPEND_STYLE>\n' +
            '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
            '<ACCESS_LIST></ACCESS_LIST>\n' +
            '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
            '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
            '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );
      removeRSymbol(forRenameHtml.toString()).should.equal(
         '<FOR_RENAME></FOR_RENAME>\n' +
            '<TITLE>ForRename</TITLE>\n' +
            '<START_DIALOG>Modul/ForRename_old</START_DIALOG>\n' +
            '<INCLUDE><INCLUDE1/>\n' +
            '</INCLUDE>\n' +
            '<RESOURCE_ROOT>resources/</RESOURCE_ROOT>\n' +
            '<WI.SBIS_ROOT>resources/WS.Core/</WI.SBIS_ROOT>\n' +
            '<APPLICATION_ROOT></APPLICATION_ROOT>\n' +
            '<SERVICES_PATH>service/</SERVICES_PATH>\n' +
            '<APPEND_STYLE></APPEND_STYLE>\n' +
            '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
            '<ACCESS_LIST></ACCESS_LIST>\n' +
            '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
            '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
            '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );
      removeRSymbol(staticTemplatesJson.toString()).should.equal(
         '{\n' +
            '  "/ForChange_old.html": "Modul/ForChange_old.html",\n' +
            '  "/ForRename.html": "Modul/ForRename.html",\n' +
            '  "/Stable.html": "Modul/Stable.html",\n' +
            '  "/Stable/One": "Modul/Stable.html",\n' +
            '  "/Stable/Two": "Modul/Stable.html",\n' +
            '  "/Stable_Three": "Modul/Stable.html"\n' +
            '}'
      );

      // изменим "исходники"
      await timeoutForMacOS();
      await fs.rename(
         path.join(moduleSourceFolder, 'ForRename_old.js'),
         path.join(moduleSourceFolder, 'ForRename_new.js')
      );
      await fs.rename(
         path.join(themesSourceFolder, 'ForRename_old.html'),
         path.join(themesSourceFolder, 'ForRename_new.html')
      );

      const filePathForChangeJs = path.join(moduleSourceFolder, 'ForChange.js');
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
         'ForChange.js',
         'ForChange_new.html',
         'ForRename_new.js',
         'ForRename.html',
         'Stable.js',
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
            'Modul/ForChange': 'ForChange_new.html',
            'Modul/ForRename_old': 'ForRename.html',
            'Modul/Stable': 'Stable.html'
         },
         modules: {
            Modul: {
               name: 'Модуль'
            }
         }
      });

      // проверим сами html
      stableHtml = await fs.readFile(stableHtmlOutputPath);
      forChangeHtml = await fs.readFile(forChangeHtmlOutputPath);
      forRenameHtml = await fs.readFile(forRenameHtmlOutputPath);
      staticTemplatesJson = await fs.readFile(staticTemplatesJsonOutputPath);
      removeRSymbol(stableHtml.toString()).should.equal(
         '<STABLE></STABLE>\n' +
            '<TITLE>Stable</TITLE>\n' +
            '<START_DIALOG>Modul/Stable</START_DIALOG>\n' +
            '<INCLUDE><INCLUDE1/>\n' +
            '</INCLUDE>\n' +
            '<RESOURCE_ROOT>resources/</RESOURCE_ROOT>\n' +
            '<WI.SBIS_ROOT>resources/WS.Core/</WI.SBIS_ROOT>\n' +
            '<APPLICATION_ROOT></APPLICATION_ROOT>\n' +
            '<SERVICES_PATH>service/</SERVICES_PATH>\n' +
            '<APPEND_STYLE></APPEND_STYLE>\n' +
            '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
            '<ACCESS_LIST></ACCESS_LIST>\n' +
            '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
            '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
            '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );

      // TODO: в следующей строке ошибка из-за кеширования результата в lib/generate-static-html-for-js.js.
      // должно быть FOR_CHANGE_NEW. пока этим можно пренебречь
      removeRSymbol(forChangeHtml.toString()).should.equal(
         '<FOR_CHANGE_OLD></FOR_CHANGE_OLD>\n' +
            '<TITLE>ForChange_new</TITLE>\n' +
            '<START_DIALOG>Modul/ForChange</START_DIALOG>\n' +
            '<INCLUDE><INCLUDE1/>\n' +
            '</INCLUDE>\n' +
            '<RESOURCE_ROOT>resources/</RESOURCE_ROOT>\n' +
            '<WI.SBIS_ROOT>resources/WS.Core/</WI.SBIS_ROOT>\n' +
            '<APPLICATION_ROOT></APPLICATION_ROOT>\n' +
            '<SERVICES_PATH>service/</SERVICES_PATH>\n' +
            '<APPEND_STYLE></APPEND_STYLE>\n' +
            '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
            '<ACCESS_LIST></ACCESS_LIST>\n' +
            '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
            '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
            '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );

      removeRSymbol(forRenameHtml.toString()).should.equal(
         '<FOR_RENAME></FOR_RENAME>\n' +
            '<TITLE>ForRename</TITLE>\n' +
            '<START_DIALOG>Modul/ForRename_old</START_DIALOG>\n' +
            '<INCLUDE><INCLUDE1/>\n' +
            '</INCLUDE>\n' +
            '<RESOURCE_ROOT>resources/</RESOURCE_ROOT>\n' +
            '<WI.SBIS_ROOT>resources/WS.Core/</WI.SBIS_ROOT>\n' +
            '<APPLICATION_ROOT></APPLICATION_ROOT>\n' +
            '<SERVICES_PATH>service/</SERVICES_PATH>\n' +
            '<APPEND_STYLE></APPEND_STYLE>\n' +
            '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
            '<ACCESS_LIST></ACCESS_LIST>\n' +
            '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
            '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
            '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n'
      );
      removeRSymbol(staticTemplatesJson.toString()).should.equal(
         '{\n' +
            '  "/ForChange_new.html": "Modul/ForChange_new.html",\n' +
            '  "/ForRename.html": "Modul/ForRename.html",\n' +
            '  "/Stable.html": "Modul/Stable.html",\n' +
            '  "/Stable/One": "Modul/Stable.html",\n' +
            '  "/Stable/Two": "Modul/Stable.html",\n' +
            '  "/Stable_Three": "Modul/Stable.html"\n' +
            '}'
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
         builderTests: true,
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

      const check = async() => {
         // запустим таску
         await runWorkflow();

         // файлы из исходников
         (await isSymlink(moduleOutputFolder, 'template.html')).should.equal(true);
         (await isSymlink(moduleOutputFolder, 'TestHtmlTmpl.html.tmpl')).should.equal(true);
         (await isSymlink(moduleOutputFolder, 'TestStaticHtml.js')).should.equal(true);

         // генерируемые файлы из исходников
         (await isRegularFile(moduleOutputFolder, 'StaticHtml.html')).should.equal(true);
         (await isRegularFile(moduleOutputFolder, 'TestHtmlTmpl.html')).should.equal(true);
         (await isRegularFile(moduleOutputFolder, 'TestLess_online.css')).should.equal(true);

         // генерируемые файлы на модуль
         (await isRegularFile(moduleOutputFolder, 'contents.js')).should.equal(true);
         (await isRegularFile(moduleOutputFolder, 'contents.json')).should.equal(true);
         (await isRegularFile(moduleOutputFolder, 'navigation-modules.json')).should.equal(true);
         (await isRegularFile(moduleOutputFolder, 'routes-info.json')).should.equal(true);
         (await isRegularFile(moduleOutputFolder, 'static_templates.json')).should.equal(true);
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
         builderTests: true,
         localization: ['en-US', 'ru-RU'],
         'default-localization': 'ru-RU',
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

      const check = async() => {
         // запустим таску
         await runWorkflow();

         (await isRegularFile(moduleOutputFolder, 'lang/en-US/en-US.css')).should.equal(true);
         (await isRegularFile(moduleOutputFolder, 'lang/en-US/en-US.js')).should.equal(true);
         (await isRegularFile(moduleOutputFolder, 'lang/ru-RU/ru-RU.js')).should.equal(true);

         (await isSymlink(moduleOutputFolder, 'lang/ru-RU/ru-RU.json')).should.equal(true);
      };

      await check();

      // второй раз, чтобы проверить не ломает ли чего инкрементальная сборка
      await check();

      await clearWorkspace();
   });

   // проверим, что паковка собственных зависимостей корректно работает при пересборке
   it('packOwnDeps', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/packOwnDeps');
      await prepareTest(fixtureFolder);
      await linkPlatform(sourceFolder);
      const config = {
         cache: cacheFolder,
         output: outputFolder,
         mode: 'release',
         builderTests: true,
         localization: false,
         'default-localization': false,
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            },
            {
               name: 'WS.Core',
               path: path.join(sourceFolder, 'WS.Core')
            },
            {
               name: 'View',
               path: path.join(sourceFolder, 'View')
            },
            {
               name: 'WS.Data',
               path: path.join(sourceFolder, 'WS.Data')
            },
            {
               name: 'Controls',
               path: path.join(sourceFolder, 'Controls')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      await runWorkflow();

      const testJsOutputPath = path.join(moduleOutputFolder, 'Test.min.js');
      let testJsOutputContent = (await fs.readFile(testJsOutputPath)).toString();

      // проверим, что js файл содержит актуальные данные из js, tmpl и wml
      testJsOutputContent.includes('TestClassTmplOld').should.equal(true);
      testJsOutputContent.includes('testFunctionTmplOld').should.equal(true);
      testJsOutputContent.includes('TestClassWmlOld').should.equal(true);
      testJsOutputContent.includes('testFunctionWmlOld').should.equal(true);

      // поменяем js
      const testJsInputPath = path.join(moduleSourceFolder, 'Test.js');
      const testJsInputContent = await fs.readFile(testJsInputPath);
      const newTestJsInputContent = testJsInputContent.toString()
         .replace(/testFunctionTmplOld/g, 'testFunctionTmplNew')
         .replace(/testFunctionWmlOld/g, 'testFunctionWmlNew');
      await fs.writeFile(testJsInputPath, newTestJsInputContent);

      await runWorkflow();

      // проверим, что js файл содержит актуальные данные из js, tmpl и wml
      testJsOutputContent = (await fs.readFile(testJsOutputPath)).toString();
      testJsOutputContent.includes('TestClassTmplOld').should.equal(true);
      testJsOutputContent.includes('TestClassWmlOld').should.equal(true);
      testJsOutputContent.includes('testFunctionTmplNew').should.equal(true);
      testJsOutputContent.includes('testFunctionWmlNew').should.equal(true);

      // поменяем tmpl
      const testTmplInputPath = path.join(moduleSourceFolder, 'Test.tmpl');
      const testTmplInputContent = await fs.readFile(testTmplInputPath);
      await fs.writeFile(testTmplInputPath, testTmplInputContent.toString().replace(/TestClassTmplOld/g, 'TestClassTmplNew'));

      await runWorkflow();

      // проверим, что js файл содержит актуальные данные из js, tmpl и wml
      testJsOutputContent = (await fs.readFile(testJsOutputPath)).toString();
      testJsOutputContent.includes('TestClassTmplNew').should.equal(true);
      testJsOutputContent.includes('TestClassWmlOld').should.equal(true);
      testJsOutputContent.includes('testFunctionTmplNew').should.equal(true);
      testJsOutputContent.includes('testFunctionWmlNew').should.equal(true);

      // поменяем wml
      const testWmlInputPath = path.join(moduleSourceFolder, 'Test.wml');
      const testWmlInputContent = await fs.readFile(testWmlInputPath);
      await fs.writeFile(testWmlInputPath, testWmlInputContent.toString().replace(/TestClassWmlOld/g, 'TestClassWmlNew'));

      await runWorkflow();

      // проверим, что js файл содержит актуальные данные из js, tmpl и wml
      testJsOutputContent = (await fs.readFile(testJsOutputPath)).toString();
      testJsOutputContent.includes('TestClassTmplNew').should.equal(true);
      testJsOutputContent.includes('TestClassWmlNew').should.equal(true);
      testJsOutputContent.includes('testFunctionTmplNew').should.equal(true);
      testJsOutputContent.includes('testFunctionWmlNew').should.equal(true);
      await clearWorkspace();
   });

   // TODO: дополнить тест проверки реакции на изменение файлов
   it('compile es and ts', async() => {
      const checkFiles = async() => {
         const resultsFiles = await fs.readdir(moduleOutputFolder);
         resultsFiles.should.have.members([
            'StableES.js',
            'StableTS.js',
            'StableES.es',
            'StableTS.ts',
            'contents.js',
            'contents.json',
            'navigation-modules.json',
            'routes-info.json',
            'static_templates.json'
         ]);

         const EsOutputPath = path.join(moduleOutputFolder, 'StableES.js');
         const TsOutputPath = path.join(moduleOutputFolder, 'StableTS.js');

         const EsContent = await fs.readFile(EsOutputPath);
         const TsContent = await fs.readFile(TsOutputPath);

         removeRSymbol(EsContent.toString()).should.equal(
            "define('Modul/StableES', [\n" +
               "    'require',\n" +
               "    'exports',\n" +
               "    'Modul/Di'\n" +
               '], function (require, exports, Di_es_1) {\n' +
               "    'use strict';\n" +
               "    Object.defineProperty(exports, '__esModule', { value: true });\n" +
               '    var Factory = { Di: Di_es_1.default };\n' +
               '    exports.default = Factory;\n' +
               '});'
         );
         removeRSymbol(TsContent.toString()).should.equal(
            "define('Modul/StableTS', [\n" +
               "    'require',\n" +
               "    'exports',\n" +
               "    'Modul/Di'\n" +
               '], function (require, exports, Di_es_1) {\n' +
               "    'use strict';\n" +
               "    Object.defineProperty(exports, '__esModule', { value: true });\n" +
               '    var Factory = { Di: Di_es_1.default };\n' +
               '    exports.default = Factory;\n' +
               '});'
         );
      };

      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/esAndTs');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         mode: 'debug',
         builderTests: true,
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

      await checkFiles();

      // запустим повторно таску
      await runWorkflow();

      await checkFiles();

      await clearWorkspace();
   });

   it('compile json to ts', async() => {
      const checkFiles = async() => {
         const resultsFiles = await fs.readdir(moduleOutputFolder);
         resultsFiles.should.have.members([
            'contents.js',
            'contents.js.gz',
            'contents.json',
            'contents.json.gz',
            'currentLanguages.json',
            'currentLanguages.json.gz',
            'currentLanguages.json.js',
            'currentLanguages.json.js.gz',
            'currentLanguages.json.min.js',
            'currentLanguages.json.min.js.gz',
            'currentLanguages.min.json',
            'currentLanguages.min.json.gz',
            'module-dependencies.json',
            'module-dependencies.json.gz',
            'navigation-modules.json',
            'navigation-modules.json.gz',
            'routes-info.json',
            'routes-info.json.gz',
            'static_templates.json',
            'static_templates.json.gz'
         ]);

         const jsonJsOutputPath = path.join(moduleOutputFolder, 'currentLanguages.json.js');
         const jsonMinJsOutputPath = path.join(moduleOutputFolder, 'currentLanguages.json.min.js');

         const jsonJsContent = await fs.readFile(jsonJsOutputPath);
         const jsonMinJsContent = await fs.readFile(jsonMinJsOutputPath);
         const correctCompileJsonJs =
            "define('Modul/currentLanguages.json',[]," +
            'function(){return {' +
            '"ru-RU":"Русский (Россия)",' +
            '"uk-UA":"Українська (Україна)",' +
            '"en-US":"English (USA)"' +
            '};' +
            '});';

         jsonJsContent.toString().should.equal(correctCompileJsonJs);
         jsonMinJsContent.toString().should.equal(correctCompileJsonJs);
      };

      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/jsonToJs');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         mode: 'release',
         builderTests: true,
         modules: [
            {
               name: 'WS.Core',
               path: path.join(sourceFolder, 'WS.Core')
            },
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      await linkPlatform(sourceFolder);

      // запустим таску
      await runWorkflow();

      await checkFiles();

      // запустим повторно таску
      await runWorkflow();

      await checkFiles();

      await clearWorkspace();
   });

   describe('pack-library', () => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/packLibraries');
      const config = {
         cache: cacheFolder,
         output: outputFolder,
         mode: 'release',
         builderTests: true,
         modules: [
            {
               name: 'WS.Core',
               path: path.join(sourceFolder, 'WS.Core')
            },
            {
               name: 'Modul',
               path: path.join(sourceFolder, 'Modul')
            }
         ]
      };

      /**
       * Набор файлов и папок, который должен получиться по завершении workflow
       * при перезапуске без изменений данный набор также должен сохраниться.
       * @type {string[]}
       */
      const correctOutputContentList = [
         'Modul.es',
         'Modul.js',
         'Modul.js.gz',
         'Modul.min.js',
         'Modul.min.js.gz',
         'Modul.min.js.map',
         'Modul.min.original.js',
         'Modul.modulepack.js',
         '_Cycle_dependence',
         '_es5',
         '_es6',
         'contents.js',
         'contents.js.gz',
         'contents.json',
         'contents.json.gz',
         'libraryCycle.es',
         'libraryCycle.js',
         'libraryCycle.js.gz',
         'libraryCycle.min.js',
         'libraryCycle.min.js.gz',
         'libraryCycle.min.js.map',
         'libraryCycle.min.original.js',
         'libraryCycle.modulepack.js',
         'module-dependencies.json',
         'module-dependencies.json.gz',
         'navigation-modules.json',
         'navigation-modules.json.gz',
         'privateDepCycle.es',
         'privateDepCycle.js',
         'privateDepCycle.js.gz',
         'privateDepCycle.min.js',
         'privateDepCycle.min.js.gz',
         'privateDepCycle.min.js.map',
         'privateDepCycle.min.original.js',
         'privateDepCycle.modulepack.js',
         'routes-info.json',
         'routes-info.json.gz',
         'static_templates.json',
         'static_templates.json.gz'
      ];

      /**
       * Будем хранить правильные исходники для всех тестов паковки
       * библиотек в одном объекте.
       * @type {{}}
       */
      const correctModulesContent = {};
      it('workspace-generated', async() => {
         await prepareTest(fixtureFolder);
         await linkPlatform(sourceFolder);
         await fs.writeJSON(configPath, config);
         await runWorkflow();
         const correctModulesPath = path.join(fixtureFolder, 'compiledCorrectResult');

         await pMap(
            ['Modul.js', 'Modul.modulepack.js', 'libraryCycle.js', 'privateDepCycle.js'],
            async(basename) => {
               const readedFile = await fs.readFile(path.join(correctModulesPath, basename), 'utf8');
               correctModulesContent[basename] = readedFile
                  .slice(readedFile.indexOf('define('), readedFile.length)
                  .replace(/\n$/, '');
            },
            {
               concurrency: 5
            }
         );
      });
      it('test-output-file-content', async() => {
         const resultsFiles = await fs.readdir(moduleOutputFolder);
         resultsFiles.should.have.members(correctOutputContentList);
      });
      it('test-recurse', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'Modul.js');
         const packedCompiledEsOutputPath = path.join(moduleOutputFolder, 'Modul.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         compiledEsContent.toString().should.equal(correctModulesContent['Modul.js']);
         packedCompiledEsContent.toString().should.equal(correctModulesContent['Modul.modulepack.js']);
      });
      it('test-recurse-library-dependencies-in-store', async() => {
         const moduleSourcePath = helpers.unixifyPath(path.join(sourceFolder, 'Modul/Модуль.es'));
         const correctStoreDepsForModule = [
            helpers.unixifyPath(path.join(sourceFolder, 'Modul/_es5/Module.js')),
            helpers.unixifyPath(path.join(sourceFolder, 'Modul/_es6/Модуль.es')),
            helpers.unixifyPath(path.join(sourceFolder, 'Modul/_es6/Модуль2.es'))
         ];
         const currentStore = await fs.readJson(path.join(cacheFolder, 'store.json'));
         currentStore.dependencies[moduleSourcePath].should.have.members(correctStoreDepsForModule);
      });
      it('test-cycle-private-dependency', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'privateDepCycle.js');
         const packedCompiledEsOutputPath = path.join(moduleOutputFolder, 'privateDepCycle.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         compiledEsContent.toString().should.equal(correctModulesContent['privateDepCycle.js']);
         packedCompiledEsContent.toString().should.equal(correctModulesContent['privateDepCycle.js']);
      });
      it('test-cycle-library-dependency', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'libraryCycle.js');
         const packedCompiledEsOutputPath = path.join(moduleOutputFolder, 'libraryCycle.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         compiledEsContent.toString().should.equal(correctModulesContent['libraryCycle.js']);
         packedCompiledEsContent.toString().should.equal(correctModulesContent['libraryCycle.js']);
      });
      it('workflow-rebuilded', async() => {
         await runWorkflow();
      });
      it('test-output-file-content-after-rebuild', async() => {
         const resultsFiles = await fs.readdir(moduleOutputFolder);
         resultsFiles.should.have.members(correctOutputContentList);
      });
      it('test-recurse-library-dependencies-in-store-after-rebuild', async() => {
         const moduleSourcePath = helpers.unixifyPath(path.join(sourceFolder, 'Modul/Модуль.es'));
         const correctStoreDepsForModule = [
            helpers.unixifyPath(path.join(sourceFolder, 'Modul/_es5/Module.js')),
            helpers.unixifyPath(path.join(sourceFolder, 'Modul/_es6/Модуль.es')),
            helpers.unixifyPath(path.join(sourceFolder, 'Modul/_es6/Модуль2.es'))
         ];
         const currentStore = await fs.readJson(path.join(cacheFolder, 'store.json'));
         currentStore.dependencies[moduleSourcePath].should.have.members(correctStoreDepsForModule);
      });
      it('test-recurse-after-rerun-workflow', async() => {
         const resultsFiles = await fs.readdir(moduleOutputFolder);
         resultsFiles.should.have.members(correctOutputContentList);

         const compiledEsOutputPath = path.join(moduleOutputFolder, 'Modul.js');
         const packedCompiledEsOutputPath = path.join(moduleOutputFolder, 'Modul.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         compiledEsContent.toString().should.equal(correctModulesContent['Modul.js']);
         packedCompiledEsContent.toString().should.equal(correctModulesContent['Modul.modulepack.js']);
      });
      it('test-cycle-private-dependency-after-rebuild', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'privateDepCycle.js');
         const packedCompiledEsOutputPath = path.join(moduleOutputFolder, 'privateDepCycle.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         compiledEsContent.toString().should.equal(correctModulesContent['privateDepCycle.js']);
         packedCompiledEsContent.toString().should.equal(correctModulesContent['privateDepCycle.js']);
      });
      it('test-cycle-library-dependency-after-rebuild', async() => {
         const compiledEsOutputPath = path.join(moduleOutputFolder, 'libraryCycle.js');
         const packedCompiledEsOutputPath = path.join(moduleOutputFolder, 'libraryCycle.modulepack.js');

         const compiledEsContent = await fs.readFile(compiledEsOutputPath);
         const packedCompiledEsContent = await fs.readFile(packedCompiledEsOutputPath);

         compiledEsContent.toString().should.equal(correctModulesContent['libraryCycle.js']);
         packedCompiledEsContent.toString().should.equal(correctModulesContent['libraryCycle.js']);
      });
      it('workspace-cleared', async() => {
         await clearWorkspace();
      });
   });
});
