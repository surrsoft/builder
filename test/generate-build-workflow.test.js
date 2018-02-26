'use strict';

const chai = require('chai'),
   path = require('path'),
   fs = require('fs-extra');

require('gulp'); //TODO: разобраться почему объявление gulp после WS не работает
require('../lib/logger').setGulpLogger(require('gulplog')); //логгер - глобальный, должен быть определён до инициализации WS
require('../gulp/helpers/node-ws').init();
const generateBuildWorkflow = require('../gulp/generate-build-workflow.js');

chai.should();

const workspaceFolder = path.join(__dirname, 'workspace'),
   cacheFolder = path.join(workspaceFolder, 'cache'),
   outputFolder = path.join(workspaceFolder, 'output'),
   sourceFolder = path.join(workspaceFolder, 'source'),
   configPath = path.join(workspaceFolder, 'config.json'),
   moduleOutputFolder = path.join(outputFolder, 'Modul'),
   moduleSourceFolder = path.join(sourceFolder, 'Модуль');

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
});
