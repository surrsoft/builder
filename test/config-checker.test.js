'use strict';

require('../lib/logger').setGulpLogger();
const Configuration = require('../gulp/builder/classes/configuration.js');
const initTest = require('./init-test');
const fs = require('fs-extra');
const path = require('path');
const workspaceFolder = path.join(__dirname, 'workspace'),
   cacheFolder = path.join(workspaceFolder, 'cache'),
   outputFolder = path.join(workspaceFolder, 'output'),
   sourceFolder = path.join(workspaceFolder, 'source'),
   configPath = path.join(workspaceFolder, 'config.json');
const processArgs = [`--config="${configPath}"`];
const clearWorkspace = function() {
   return fs.remove(workspaceFolder);
};

const prepareTest = async function(fixtureFolder) {
   await clearWorkspace();
   await fs.ensureDir(sourceFolder);
   await fs.copy(fixtureFolder, sourceFolder);
};
describe('configuration checker', () => {
   before(async() => {
      await initTest();
   });
   describe('initCore flag must be configured properly', () => {
      const runTest = async(gulpConfig, expectedValue) => {
         const fixtureFolder = path.join(__dirname, 'fixture/builder-generate-workflow/less');
         await prepareTest(fixtureFolder);

         await fs.outputJson(configPath, gulpConfig);
         const config = new Configuration();
         config.loadSync(processArgs);
         config.initCore.should.equal(expectedValue);
      };
      it('builder tests - true', async() => {
         const gulpConfig = {
            cache: cacheFolder,
            output: outputFolder,
            builderTests: true,
            modules: [
               {
                  name: 'Модуль',
                  path: path.join(sourceFolder, 'Модуль')
               },
               {
                  name: 'Модуль без тем',
                  path: path.join(sourceFolder, 'Модуль без тем')
               }
            ]
         };
         await runTest(gulpConfig, true);
      });
      it('with localization - true', async() => {
         const gulpConfig = {
            cache: cacheFolder,
            output: outputFolder,
            localization: [
               'en-US',
               'ru-RU'
            ],
            'default-localization': 'ru-RU',
            modules: [
               {
                  name: 'Модуль',
                  path: path.join(sourceFolder, 'Модуль')
               },
               {
                  name: 'Модуль без тем',
                  path: path.join(sourceFolder, 'Модуль без тем')
               }
            ]
         };
         await runTest(gulpConfig, true);
      });
      it('with templates - true', async() => {
         const gulpConfig = {
            cache: cacheFolder,
            output: outputFolder,
            wml: true,
            modules: [
               {
                  name: 'Модуль',
                  path: path.join(sourceFolder, 'Модуль')
               },
               {
                  name: 'Модуль без тем',
                  path: path.join(sourceFolder, 'Модуль без тем')
               }
            ]
         };
         await runTest(gulpConfig, true);
         delete gulpConfig.wml;
         gulpConfig.deprecatedXhtml = true;
         await runTest(gulpConfig, true);
         delete gulpConfig.deprecatedXhtml;
         gulpConfig.htmlWml = true;
         await runTest(gulpConfig, true);
      });
      it('without templates, localization and not builder units - false', async() => {
         const gulpConfig = {
            cache: cacheFolder,
            output: outputFolder,
            modules: [
               {
                  name: 'Модуль',
                  path: path.join(sourceFolder, 'Модуль')
               },
               {
                  name: 'Модуль без тем',
                  path: path.join(sourceFolder, 'Модуль без тем')
               }
            ]
         };
         await runTest(gulpConfig, false);
      });
   });
});