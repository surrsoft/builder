'use strict';

const initTest = require('./init-test');

const path = require('path'),
   fs = require('fs-extra');

const generateWorkflow = require('../gulp/builder/generate-workflow.js');

const { isRegularFile } = require('./lib');

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

   it('remove private parts of packed library', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/copy-sources/libraries-pack');
      await prepareTest(fixtureFolder);

      const config = {
         cache: cacheFolder,
         output: outputFolder,
         typescript: true,
         less: true,
         themes: true,
         wml: true,
         minimize: true,
         dependenciesGraph: true,
         sources: false,
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

      (await isRegularFile(moduleOutputFolder, 'library1.min.js')).should.equal(true);
      (await isRegularFile(moduleOutputFolder, 'library1.js')).should.equal(false);

      // all packed private parts of library should be remove from the output directory
      (await isRegularFile(path.join(moduleOutputFolder, '_private'), 'module1.ts')).should.equal(false);
      (await isRegularFile(path.join(moduleOutputFolder, '_private'), 'module1.js')).should.equal(false);
      (await isRegularFile(path.join(moduleOutputFolder, '_private'), 'module1.min.js')).should.equal(false);
      (await isRegularFile(path.join(moduleOutputFolder, '_private'), 'template1.tmpl')).should.equal(false);
      (await isRegularFile(path.join(moduleOutputFolder, '_private'), 'template1.min.tmpl')).should.equal(false);
      await clearWorkspace();
   });
});
