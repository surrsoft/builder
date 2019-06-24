'use strict';

const initTest = require('./init-test');

const path = require('path'),
   fs = require('fs-extra');

const generateWorkflow = require('../gulp/builder/generate-workflow.js');

const { isRegularFile, linkPlatform } = require('./lib');

const workspaceFolder = path.join(__dirname, 'workspace'),
   cacheFolder = path.join(workspaceFolder, 'cache'),
   outputFolder = path.join(workspaceFolder, 'output'),
   sourceFolder = path.join(workspaceFolder, 'source'),
   configPath = path.join(workspaceFolder, 'config.json'),
   moduleOutputFolder = path.join(outputFolder, 'Modul');

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

describe('copy sources', () => {
   before(async() => {
      await initTest();
   });

   it('private parts of packed library, desktop app: should remove file from versioned and cdn meta, from output directory', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/copy-sources/libraries-pack');
      await prepareTest(fixtureFolder);
      await linkPlatform(sourceFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         typescript: true,
         less: true,
         themes: true,
         wml: true,
         minimize: true,
         dependenciesGraph: true,
         version: 'test',
         sources: false,
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль'),
            },
            {
               name: 'WS.Core',
               path: path.join(sourceFolder, 'WS.Core'),
               required: true
            },
            {
               name: 'View',
               path: path.join(sourceFolder, 'View'),
               required: true
            },
            {
               name: 'Vdom',
               path: path.join(sourceFolder, 'Vdom'),
               required: true
            },
            {
               name: 'Router',
               path: path.join(sourceFolder, 'Router'),
               required: true
            },
            {
               name: 'Application',
               path: path.join(sourceFolder, 'Application'),
               required: true
            },
            {
               name: 'Inferno',
               path: path.join(sourceFolder, 'Inferno'),
               required: true
            },
            {
               name: 'Env',
               path: path.join(sourceFolder, 'Env'),
               required: true
            },
            {
               name: 'SbisEnv',
               path: path.join(sourceFolder, 'SbisEnv'),
               required: true
            },
            {
               name: 'Browser',
               path: path.join(sourceFolder, 'Browser'),
               required: true
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflow();

      (await isRegularFile(moduleOutputFolder, 'library1.min.js')).should.equal(true);
      (await isRegularFile(moduleOutputFolder, 'library1.js')).should.equal(false);

      // all packed private parts of library should be remove from the output directory
      (await isRegularFile(path.join(moduleOutputFolder, '_private'), 'module1.ts')).should.equal(false);
      (await isRegularFile(path.join(moduleOutputFolder, '_private'), 'module1.js')).should.equal(false);
      (await isRegularFile(path.join(moduleOutputFolder, '_private'), 'module1.min.js')).should.equal(false);
      (await isRegularFile(path.join(moduleOutputFolder, '_private'), 'template1.tmpl')).should.equal(false);
      (await isRegularFile(path.join(moduleOutputFolder, '_private'), 'template1.min.tmpl')).should.equal(false);

      // check versioned and cdn meta for removed private parts of library
      const versionedModulesMeta = await fs.readJson(path.join(moduleOutputFolder, '.builder/versioned_modules.json'));
      const cdnModulesMeta = await fs.readJson(path.join(moduleOutputFolder, '.builder/cdn_modules.json'));

      cdnModulesMeta.length.should.equal(0);
      versionedModulesMeta.length.should.equal(0);
      await clearWorkspace();
   });

   it('copy sources without version flag configured should be completed without errors', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/copy-sources/libraries-pack');
      await prepareTest(fixtureFolder);
      await linkPlatform(sourceFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         minimize: true,
         sources: false,
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль'),
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // build should be completed without errors
      await runWorkflow();

      await clearWorkspace();
   });
});
