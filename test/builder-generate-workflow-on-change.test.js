'use strict';

require('./init-test');

const path = require('path'),
   fs = require('fs-extra');

const generateWorkflow = require('../gulp/builder/generate-workflow.js'),
   generateWorkflowOnChange = require('../gulp/builder/generate-workflow-on-change.js');

const workspaceFolder = path.join(__dirname, 'workspace'),
   cacheFolder = path.join(workspaceFolder, 'cache'),
   outputFolder = path.join(workspaceFolder, 'output'),
   sourceFolder = path.join(workspaceFolder, 'source'),
   configPath = path.join(workspaceFolder, 'config.json'),
   moduleOutputFolder = path.join(outputFolder, 'Modul'),
   moduleSourceFolder = path.join(sourceFolder, 'Модуль');

const {
   isSymlink, isRegularFile
} = require('./lib');


const clearWorkspace = function() {
   return fs.remove(workspaceFolder);
};

const prepareTest = async function(fixtureFolder) {
   await clearWorkspace();
   await fs.ensureDir(sourceFolder);
   await fs.copy(fixtureFolder, sourceFolder);
};

const runWorkflowBuild = function() {
   return new Promise((resolve) => {
      generateWorkflow([`--config="${configPath}"`])(resolve);
   });
};

const runWorkflowBuildOnChange = function(filePath) {
   return new Promise((resolve) => {
      generateWorkflowOnChange([`--config="${configPath}"`, `--filePath="${filePath}"`])(resolve);
   });
};

describe('gulp/builder/generate-workflow-on-change.js', () => {
   it('compile less', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow-on-change/less');
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
      await runWorkflowBuild();

      // проверим, что все нужные файлы есть в "стенде"
      let resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForRename_old.css',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      const forRenameNewFilePath = path.join(moduleSourceFolder, 'ForRename_new.less');
      await fs.rename(
         path.join(moduleSourceFolder, 'ForRename_old.less'),
         forRenameNewFilePath
      );

      await runWorkflowBuildOnChange(forRenameNewFilePath);

      // проверим, что все нужные файлы появились в "стенде"
      // старый файл ForRename_old остаётся. это нормально
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForRename_old.css',
         'ForRename_new.css',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);
      (await isRegularFile(moduleOutputFolder, 'ForRename_new.css')).should.equal(true);

      // запустим таску повторно
      await runWorkflowBuild();

      // проверим, что все лишние файлы (ForRename_old.css) удалились
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'ForRename_new.css',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      await clearWorkspace();
   });

   it('create symlink or copy', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow-on-change/symlink');
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
      await runWorkflowBuild();

      // проверим, что все нужные файлы есть в "стенде"
      let resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'Test.js',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      // проверим, что запуск на несуществующем файле вне проекта нормально проходит
      await runWorkflowBuildOnChange(path.join(path.dirname(moduleSourceFolder), 'Test_new.js'));

      // проверим как работает build-on-change при переименовывании файла
      const newFilePath = path.join(moduleSourceFolder, 'Test_new.js');
      await fs.rename(
         path.join(moduleSourceFolder, 'Test.js'),
         newFilePath
      );

      await runWorkflowBuildOnChange(newFilePath);

      // проверим, что все нужные файлы появились в "стенде"
      // старый файл Test.js остаётся. это нормально
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'Test_new.js',
         'Test.js',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);
      (await isSymlink(moduleOutputFolder, 'Test_new.js')).should.equal(true);

      // запустим таску повторно
      await runWorkflowBuild();

      // проверим, что все лишние файлы (Test.js) удалились
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'Test_new.js',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      await clearWorkspace();
   });

   // если модуль расположен по симлинку, слежение за файлами всё равно должно работать.
   it('module as symlink', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow-on-change/symlink');
      const sourceModuleCopied = path.join(workspaceFolder, 'sourceCopied', 'Модуль');
      const sourceModuleSymlink = path.join(sourceFolder, 'Модуль');
      await clearWorkspace();
      await fs.ensureDir(sourceFolder);
      await fs.copy(path.join(fixtureFolder, 'Модуль'), sourceModuleCopied);
      await fs.symlink(sourceModuleCopied, sourceModuleSymlink);

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
      await runWorkflowBuild();

      // проверим, что все нужные файлы есть в "стенде"
      let resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'Test.js',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      // переименуем файл Test.js в скопированном каталоге
      await fs.move(path.join(sourceModuleCopied, 'Test.js'), path.join(sourceModuleCopied, 'Test_new.js'));

      // запустим пересборку из скопированной папки
      await runWorkflowBuildOnChange(path.join(sourceModuleCopied, 'Test_new.js'));

      // проверим, что Test_new.js появился в стенде
      resultsFiles = await fs.readdir(moduleOutputFolder);
      resultsFiles.should.have.members([
         'Test_new.js',
         'Test.js',
         'contents.js',
         'contents.json',
         'navigation-modules.json',
         'routes-info.json',
         'static_templates.json'
      ]);

      await clearWorkspace();
   });
});
