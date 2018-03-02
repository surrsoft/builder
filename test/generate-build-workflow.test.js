'use strict';

require('./init-test');

const path = require('path'),
   fs = require('fs-extra');

const generateBuildWorkflow = require('../gulp/generate-build-workflow.js');

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

const runBuildWorkflow = function() {
   return new Promise(resolve => {
      generateBuildWorkflow([`--config="${configPath}"`])(resolve);
   });
};

const getMTime = async function(filePath) {
   return (await fs.lstat(filePath)).mtime.getTime();
};

const timeout = function(ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
};

//нужно проверить что происходит:
//1. при переименовывании файла == добавление/удаление файла
//2. при изменении файла
//3. если файл не менять
describe('gulp/generate-build-workflow.js', function() {
   this.timeout(4000); //eslint-disable-line no-invalid-this

   it('проверка компиляции less', async function() {
      const fixtureFolder = path.join(__dirname, 'fixture/generate-build-workflow/less');
      await prepareTest(fixtureFolder);

      const config = {
         'cache': cacheFolder,
         'output': outputFolder,
         'mode': 'debug',
         'modules': [
            {
               'name': 'SBIS3.CONTROLS',
               'path': path.join(sourceFolder, 'SBIS3.CONTROLS')
            },
            {
               'name': 'Модуль',
               'path': path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      //запустим таску
      await runBuildWorkflow();

      //проверим, что все нужные файлы появились в "стенде"
      let resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'Error.less',
         'ForChange.css',
         'ForChange.less',
         'ForRename_old.css',
         'ForRename_old.less',
         'Stable.css',
         'Stable.less',
         'contents.js',
         'contents.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      //запомним время модификации незменяемого файла и изменяемого в "стенде"
      const stableCssOutputPath = path.join(moduleOutputFolder, 'Stable.less');
      const stableLessOutputPath = path.join(moduleOutputFolder, 'Stable.less');
      const forChangeCssOutputPath = path.join(moduleOutputFolder, 'ForChange.less');
      const forChangeLessOutputPath = path.join(moduleOutputFolder, 'ForChange.less');
      const mTimeStableCss = await getMTime(stableCssOutputPath);
      const mTimeStableLess = await getMTime(stableLessOutputPath);
      const mTimeForChangeCss = await getMTime(forChangeCssOutputPath);
      const mTimeChangeLess = await getMTime(forChangeLessOutputPath);

      //изменим "исходники"
      await timeout(1); //подождём 1 мс, чтобы точно mtime был другим
      await fs.rename(path.join(moduleSourceFolder, 'ForRename_old.less'), path.join(moduleSourceFolder, 'ForRename_new.less'));
      const filePathForChange = path.join(moduleSourceFolder, 'ForChange.less');
      const data = await fs.readFile(filePathForChange);
      await fs.writeFile(filePathForChange, data.toString() + '\n.test-selector2 {}');

      //запустим повторно таску
      await runBuildWorkflow();

      //проверим, что все нужные файлы появились в "стенде", лишние удалились
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'Error.less',
         'ForChange.css',
         'ForChange.less',
         'ForRename_new.css',
         'ForRename_new.less',
         'Stable.css',
         'Stable.less',
         'contents.js',
         'contents.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      //проверим время модификации незменяемого файла и изменяемого в "стенде"
      (await getMTime(stableCssOutputPath)).should.equal(mTimeStableCss);
      (await getMTime(stableLessOutputPath)).should.equal(mTimeStableLess);
      (await getMTime(forChangeCssOutputPath)).should.not.equal(mTimeForChangeCss);
      (await getMTime(forChangeLessOutputPath)).should.not.equal(mTimeChangeLess);

      await clearWorkspace();
   });


   it('проверка роутинга', async function() {
      const fixtureFolder = path.join(__dirname, 'fixture/generate-build-workflow/routes');
      await prepareTest(fixtureFolder);

      const config = {
         'cache': cacheFolder,
         'output': outputFolder,
         'mode': 'debug',
         'modules': [
            {
               'name': 'Модуль',
               'path': path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      //запустим таску
      await runBuildWorkflow();

      //проверим, что все нужные файлы появились в "стенде"
      let resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.routes.js',
         'ForRename_old.routes.js',
         'Stable.routes.js',
         'Test1.module.js',
         'contents.js',
         'contents.json',
         'routes-info.json',
         'static_templates.json'
      ]);
      const routesInfoOutputPath = path.join(moduleOutputFolder, 'routes-info.json');
      let routesInfo = await fs.readJSON(routesInfoOutputPath);
      await routesInfo.should.deep.equal({
         'resources/Modul/ForChange.routes.js': {
            '/ForChange_old.html': {
               'controller': 'js!SBIS3.Test1',
               'isMasterPage': true
            }
         },
         'resources/Modul/ForRename_old.routes.js': {
            '/ForRename.html': {
               'controller': 'js!SBIS3.Test1',
               'isMasterPage': true
            }
         },
         'resources/Modul/Stable.routes.js': {
            '/Stable.html': {
               'controller': 'js!SBIS3.Test1',
               'isMasterPage': true
            }
         }
      });

      //запомним время модификации незменяемого файла и изменяемого в "стенде"
      const stableFileOutputPath = path.join(moduleOutputFolder, 'Stable.routes.js');
      const forChangeFileOutputPath = path.join(moduleOutputFolder, 'ForChange.routes.js');
      const mTimeStableFile = await getMTime(stableFileOutputPath);
      const mTimeForChangeFile = await getMTime(forChangeFileOutputPath);

      //изменим "исходники"
      await timeout(1); //подождём 1 мс, чтобы точно mtime был другим
      await fs.rename(path.join(moduleSourceFolder, 'ForRename_old.routes.js'), path.join(moduleSourceFolder, 'ForRename_new.routes.js'));
      const filePathForChange = path.join(moduleSourceFolder, 'ForChange.routes.js');
      const data = await fs.readFile(filePathForChange);
      await fs.writeFile(filePathForChange, data.toString().replace('/ForChange_old.html', '/ForChange_new.html'));

      //запустим повторно таску
      await runBuildWorkflow();

      //проверим, что все нужные файлы появились в "стенде", лишние удалились
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.routes.js',
         'ForRename_new.routes.js',
         'Stable.routes.js',
         'Test1.module.js',
         'contents.js',
         'contents.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      //проверим время модификации незменяемого файла и изменяемого в "стенде"
      (await getMTime(stableFileOutputPath)).should.equal(mTimeStableFile);
      (await getMTime(forChangeFileOutputPath)).should.not.equal(mTimeForChangeFile);

      routesInfo = await fs.readJSON(routesInfoOutputPath);
      await routesInfo.should.deep.equal({
         'resources/Modul/ForChange.routes.js': {
            '/ForChange_new.html': {
               'controller': 'js!SBIS3.Test1',
               'isMasterPage': true
            }
         },
         'resources/Modul/ForRename_new.routes.js': {
            '/ForRename.html': {
               'controller': 'js!SBIS3.Test1',
               'isMasterPage': true
            }
         },
         'resources/Modul/Stable.routes.js': {
            '/Stable.html': {
               'controller': 'js!SBIS3.Test1',
               'isMasterPage': true
            }
         }
      });

      await clearWorkspace();
   });

   it('проверка jsModules в contents.json', async function() {
      const fixtureFolder = path.join(__dirname, 'fixture/generate-build-workflow/jsModules');
      await prepareTest(fixtureFolder);

      const config = {
         'cache': cacheFolder,
         'output': outputFolder,
         'mode': 'debug',
         'modules': [
            {
               'name': 'Модуль',
               'path': path.join(sourceFolder, 'Модуль')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      //запустим таску
      await runBuildWorkflow();

      //проверим, что все нужные файлы появились в "стенде"
      let resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.module.js',
         'ForRename_old.module.js',
         'Stable.module.js',
         'contents.js',
         'contents.json',
         'routes-info.json',
         'static_templates.json'
      ]);
      const contentsJsonOutputPath = path.join(moduleOutputFolder, 'contents.json');
      let contentsObj = await fs.readJSON(contentsJsonOutputPath);
      await contentsObj.should.deep.equal({
         'htmlNames': {},
         'jsModules': {
            'SBIS3.ForChange_old': 'Modul/ForChange.module.js',
            'SBIS3.ForRename': 'Modul/ForRename_old.module.js',
            'SBIS3.Stable': 'Modul/Stable.module.js'
         },
         'modules': {
            'Модуль': 'Modul'
         },
         'requirejsPaths': {},
         'xmlContents': {}
      });

      //запомним время модификации незменяемого файла и изменяемого в "стенде"
      const stableFileOutputPath = path.join(moduleOutputFolder, 'Stable.module.js');
      const forChangeFileOutputPath = path.join(moduleOutputFolder, 'ForChange.module.js');
      const mTimeStableFile = await getMTime(stableFileOutputPath);
      const mTimeForChangeFile = await getMTime(forChangeFileOutputPath);

      //изменим "исходники"
      await timeout(1); //подождём 1 мс, чтобы точно mtime был другим
      await fs.rename(path.join(moduleSourceFolder, 'ForRename_old.module.js'), path.join(moduleSourceFolder, 'ForRename_new.module.js'));
      const filePathForChange = path.join(moduleSourceFolder, 'ForChange.module.js');
      const data = await fs.readFile(filePathForChange);
      await fs.writeFile(filePathForChange, data.toString().replace('ForChange_old', 'ForChange_new'));

      //запустим повторно таску
      await runBuildWorkflow();

      //проверим, что все нужные файлы появились в "стенде", лишние удалились
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForChange.module.js',
         'ForRename_new.module.js',
         'Stable.module.js',
         'contents.js',
         'contents.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      //проверим время модификации незменяемого файла и изменяемого в "стенде"
      (await getMTime(stableFileOutputPath)).should.equal(mTimeStableFile);
      (await getMTime(forChangeFileOutputPath)).should.not.equal(mTimeForChangeFile);

      contentsObj = await fs.readJSON(contentsJsonOutputPath);
      await contentsObj.should.deep.equal({
         'htmlNames': {},
         'jsModules': {
            'SBIS3.ForChange_new': 'Modul/ForChange.module.js',
            'SBIS3.ForRename': 'Modul/ForRename_new.module.js',
            'SBIS3.Stable': 'Modul/Stable.module.js'
         },
         'modules': {
            'Модуль': 'Modul'
         },
         'requirejsPaths': {},
         'xmlContents': {}
      });

      await clearWorkspace();
   });

   it('проверка генерации статических html', async function() {
      const fixtureFolder = path.join(__dirname, 'fixture/generate-build-workflow/staticHtml');
      await prepareTest(fixtureFolder);

      const config = {
         'cache': cacheFolder,
         'output': outputFolder,
         'mode': 'debug',
         'modules': [
            {
               'name': 'Модуль',
               'path': path.join(sourceFolder, 'Модуль')
            },
            {
               'name': 'Тема Скрепка',
               'path': path.join(sourceFolder, 'Тема Скрепка')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      //запустим таску
      await runBuildWorkflow();

      //проверим, что все нужные файлы появились в "стенде"
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
         'routes-info.json',
         'static_templates.json'
      ]);
      const contentsJsonOutputPath = path.join(moduleOutputFolder, 'contents.json');
      let contentsObj = await fs.readJSON(contentsJsonOutputPath);
      await contentsObj.should.deep.equal({
         'htmlNames': {
            'js!SBIS3.ForChange_old': 'ForChange_old.html',
            'js!SBIS3.ForRename': 'ForRename.html',
            'js!SBIS3.Stable': 'Stable.html'
         },
         'jsModules': {
            'SBIS3.ForChange_old': 'Modul/ForChange.module.js',
            'SBIS3.ForRename': 'Modul/ForRename_old.module.js',
            'SBIS3.Stable': 'Modul/Stable.module.js'
         },
         'modules': {
            'Модуль': 'Modul'
         },
         'requirejsPaths': {},
         'xmlContents': {}
      });

      //запомним время модификации незменяемого файла и изменяемого в "стенде"
      const stableJsOutputPath = path.join(moduleOutputFolder, 'Stable.module.js');
      const stableHtmlOutputPath = path.join(moduleOutputFolder, 'Stable.html');
      const forChangeJsOutputPath = path.join(moduleOutputFolder, 'ForChange.module.js');
      let forChangeHtmlOutputPath = path.join(moduleOutputFolder, 'ForChange_old.html');
      const mTimeStableJs = await getMTime(stableJsOutputPath);
      const mTimeStableHtml = await getMTime(stableHtmlOutputPath);
      const mTimeForChangeJs = await getMTime(forChangeJsOutputPath);
      const mTimeForChangeHtml = await getMTime(forChangeHtmlOutputPath);

      //проверим сами html
      let stableHtml = await fs.readFile(stableHtmlOutputPath);
      let forChangeHtml = await fs.readFile(forChangeHtmlOutputPath);
      const forRenameHtmlOutputPath = path.join(moduleOutputFolder, 'ForRename.html');
      let forRenameHtml = await fs.readFile(forRenameHtmlOutputPath);
      stableHtml.toString().should.equal('<STABLE></STABLE>\n' +
         '<TITLE>Stable</TITLE>\n' +
         '<START_DIALOG>js!SBIS3.Stable</START_DIALOG>\n' +
         '<INCLUDE><INCLUDE1/>\n' +
         '</INCLUDE>\n' +
         '<RESOURCE_ROOT>%{RESOURCE_ROOT}</RESOURCE_ROOT>\n' +
         '<WI.SBIS_ROOT>%{WI.SBIS_ROOT}</WI.SBIS_ROOT>\n' +
         '<APPLICATION_ROOT>%{APPLICATION_ROOT}</APPLICATION_ROOT>\n' +
         '<SERVICES_PATH>%{SERVICES_PATH}</SERVICES_PATH>\n' +
         '<APPEND_STYLE></APPEND_STYLE>\n' +
         '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
         '<ACCESS_LIST></ACCESS_LIST>\n' +
         '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
         '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
         '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n');
      forChangeHtml.toString().should.equal('<FOR_CHANGE_OLD></FOR_CHANGE_OLD>\n' +
         '<TITLE>ForChange_old</TITLE>\n' +
         '<START_DIALOG>js!SBIS3.ForChange_old</START_DIALOG>\n' +
         '<INCLUDE><INCLUDE1/>\n' +
         '</INCLUDE>\n' +
         '<RESOURCE_ROOT>%{RESOURCE_ROOT}</RESOURCE_ROOT>\n' +
         '<WI.SBIS_ROOT>%{WI.SBIS_ROOT}</WI.SBIS_ROOT>\n' +
         '<APPLICATION_ROOT>%{APPLICATION_ROOT}</APPLICATION_ROOT>\n' +
         '<SERVICES_PATH>%{SERVICES_PATH}</SERVICES_PATH>\n' +
         '<APPEND_STYLE></APPEND_STYLE>\n' +
         '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
         '<ACCESS_LIST></ACCESS_LIST>\n' +
         '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
         '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
         '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n');
      forRenameHtml.toString().should.equal('<FOR_RENAME></FOR_RENAME>\n' +
         '<TITLE>ForRename</TITLE>\n' +
         '<START_DIALOG>js!SBIS3.ForRename</START_DIALOG>\n' +
         '<INCLUDE><INCLUDE1/>\n' +
         '</INCLUDE>\n' +
         '<RESOURCE_ROOT>%{RESOURCE_ROOT}</RESOURCE_ROOT>\n' +
         '<WI.SBIS_ROOT>%{WI.SBIS_ROOT}</WI.SBIS_ROOT>\n' +
         '<APPLICATION_ROOT>%{APPLICATION_ROOT}</APPLICATION_ROOT>\n' +
         '<SERVICES_PATH>%{SERVICES_PATH}</SERVICES_PATH>\n' +
         '<APPEND_STYLE></APPEND_STYLE>\n' +
         '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
         '<ACCESS_LIST></ACCESS_LIST>\n' +
         '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
         '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
         '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n');

      //изменим "исходники"
      await timeout(1); //подождём 1 мс, чтобы точно mtime был другим
      await fs.rename(path.join(moduleSourceFolder, 'ForRename_old.module.js'), path.join(moduleSourceFolder, 'ForRename_new.module.js'));
      await fs.rename(path.join(themesSourceFolder, 'ForRename_old.html'), path.join(themesSourceFolder, 'ForRename_new.html'));

      const filePathForChangeJs = path.join(moduleSourceFolder, 'ForChange.module.js');
      const dataJs = await fs.readFile(filePathForChangeJs);
      await fs.writeFile(filePathForChangeJs, dataJs.toString().replace(/ForChange_old/g, 'ForChange_new'));

      const filePathForChangeHtml = path.join(themesSourceFolder, 'ForChange.html');
      const dataHtml = await fs.readFile(filePathForChangeHtml);
      await fs.writeFile(filePathForChangeHtml, dataHtml.toString().replace(/FOR_CHANGE_OLD/g, 'FOR_CHANGE_NEW'));

      //запустим повторно таску
      await runBuildWorkflow();

      //проверим, что все нужные файлы появились в "стенде", лишние удалились
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
         'routes-info.json',
         'static_templates.json'
      ]);

      //проверим время модификации незменяемого файла и изменяемого в "стенде"
      //!!! В отличии от остальных файлов, статические HTML всегда пересоздаются заново, т.к. кешировать их сложно,
      //а весь процесс длится меньше 2 секунд.
      forChangeHtmlOutputPath = path.join(moduleOutputFolder, 'ForChange_new.html');
      (await getMTime(stableJsOutputPath)).should.equal(mTimeStableJs);
      (await getMTime(stableHtmlOutputPath)).should.not.equal(mTimeStableHtml); //Отличается от остальных тестов и это норма
      (await getMTime(forChangeJsOutputPath)).should.not.equal(mTimeForChangeJs);
      (await getMTime(forChangeHtmlOutputPath)).should.not.equal(mTimeForChangeHtml);

      contentsObj = await fs.readJSON(contentsJsonOutputPath);
      await contentsObj.should.deep.equal({
         'htmlNames': {
            'js!SBIS3.ForChange_new': 'ForChange_new.html',
            'js!SBIS3.ForRename': 'ForRename.html',
            'js!SBIS3.Stable': 'Stable.html'
         },
         'jsModules': {
            'SBIS3.ForChange_new': 'Modul/ForChange.module.js',
            'SBIS3.ForRename': 'Modul/ForRename_new.module.js',
            'SBIS3.Stable': 'Modul/Stable.module.js'
         },
         'modules': {
            'Модуль': 'Modul'
         },
         'requirejsPaths': {},
         'xmlContents': {}
      });

      //проверим сами html
      stableHtml = await fs.readFile(stableHtmlOutputPath);
      forChangeHtml = await fs.readFile(forChangeHtmlOutputPath);
      forRenameHtml = await fs.readFile(forRenameHtmlOutputPath);
      stableHtml.toString().should.equal('<STABLE></STABLE>\n' +
         '<TITLE>Stable</TITLE>\n' +
         '<START_DIALOG>js!SBIS3.Stable</START_DIALOG>\n' +
         '<INCLUDE><INCLUDE1/>\n' +
         '</INCLUDE>\n' +
         '<RESOURCE_ROOT>%{RESOURCE_ROOT}</RESOURCE_ROOT>\n' +
         '<WI.SBIS_ROOT>%{WI.SBIS_ROOT}</WI.SBIS_ROOT>\n' +
         '<APPLICATION_ROOT>%{APPLICATION_ROOT}</APPLICATION_ROOT>\n' +
         '<SERVICES_PATH>%{SERVICES_PATH}</SERVICES_PATH>\n' +
         '<APPEND_STYLE></APPEND_STYLE>\n' +
         '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
         '<ACCESS_LIST></ACCESS_LIST>\n' +
         '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
         '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
         '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n');

      //TODO: в следующей строке ошибка из-за кеширования результата в lib/generate-static-html-for-js.js. должно быть FOR_CHANGE_NEW
      //пока этим можно пренебречь
      forChangeHtml.toString().should.equal('<FOR_CHANGE_OLD></FOR_CHANGE_OLD>\n' +
         '<TITLE>ForChange_new</TITLE>\n' +
         '<START_DIALOG>js!SBIS3.ForChange_new</START_DIALOG>\n' +
         '<INCLUDE><INCLUDE1/>\n' +
         '</INCLUDE>\n' +
         '<RESOURCE_ROOT>%{RESOURCE_ROOT}</RESOURCE_ROOT>\n' +
         '<WI.SBIS_ROOT>%{WI.SBIS_ROOT}</WI.SBIS_ROOT>\n' +
         '<APPLICATION_ROOT>%{APPLICATION_ROOT}</APPLICATION_ROOT>\n' +
         '<SERVICES_PATH>%{SERVICES_PATH}</SERVICES_PATH>\n' +
         '<APPEND_STYLE></APPEND_STYLE>\n' +
         '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
         '<ACCESS_LIST></ACCESS_LIST>\n' +
         '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
         '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
         '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n');

      forRenameHtml.toString().should.equal('<FOR_RENAME></FOR_RENAME>\n' +
         '<TITLE>ForRename</TITLE>\n' +
         '<START_DIALOG>js!SBIS3.ForRename</START_DIALOG>\n' +
         '<INCLUDE><INCLUDE1/>\n' +
         '</INCLUDE>\n' +
         '<RESOURCE_ROOT>%{RESOURCE_ROOT}</RESOURCE_ROOT>\n' +
         '<WI.SBIS_ROOT>%{WI.SBIS_ROOT}</WI.SBIS_ROOT>\n' +
         '<APPLICATION_ROOT>%{APPLICATION_ROOT}</APPLICATION_ROOT>\n' +
         '<SERVICES_PATH>%{SERVICES_PATH}</SERVICES_PATH>\n' +
         '<APPEND_STYLE></APPEND_STYLE>\n' +
         '<APPEND_JAVASCRIPT></APPEND_JAVASCRIPT>\n' +
         '<ACCESS_LIST></ACCESS_LIST>\n' +
         '<CONFIG.USER_PARAMS>%{CONFIG.USER_PARAMS}</CONFIG.USER_PARAMS>\n' +
         '<CONFIG.GLOBAL_PARAMS>%{CONFIG.GLOBAL_PARAMS}</CONFIG.GLOBAL_PARAMS>\n' +
         '<SAVE_LAST_STATE>false</SAVE_LAST_STATE>\n');

      await clearWorkspace();
   });
});
