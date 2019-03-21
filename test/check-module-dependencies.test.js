'use strict';

const initTest = require('./init-test');
const path = require('path');
const {
   excludeModuleNames,
   getCurrentNodePlugin,
   checkDependencyForExcludeRules,
   getModuleInfoForCurrentNode,
   isValidDependency
} = require('../lib/check-module-dependencies');

describe('check-module-dependencies', () => {
   const moduleDependencies = {
      nodes: {
         'css!MyModule/module1': {
            path: 'path/to/css/MyModule/module1'
         },
         'MyModule/module1': {
            path: 'path/to/MyModule/module1'
         }
      }
   };
   const outputDirectory = path.join(__dirname, 'fixture/check-module-dependencies');
   before(async() => {
      await initTest();
   });

   it('check node plugin getter', () => {
      let currentName = 'css!myModule/module1';
      let result = getCurrentNodePlugin(currentName);
      result.should.equal('css');
      currentName = 'is!browser?myModule/module1';
      result = getCurrentNodePlugin(currentName);
      result.should.equal('');
      currentName = 'is!browser?is!compatibleLayer?optional!myModule/module1';
      result = getCurrentNodePlugin(currentName);
      result.should.equal('');
      currentName = 'is!browser?is!compatibleLayer?optional!wml!myModule/module1';
      result = getCurrentNodePlugin(currentName);
      result.should.equal('wml');
   });

   it('check dependency for exclude rules', () => {
      excludeModuleNames.forEach((currentExcludeModuleName) => {
         const result = checkDependencyForExcludeRules(currentExcludeModuleName, currentExcludeModuleName);
         result.should.equal(true);
      });
      let currentName = 'MyModule1/Module';
      let result = checkDependencyForExcludeRules(currentName, currentName);
      result.should.equal(false);
      currentName = 'optional!MyModule/module1';
      result = checkDependencyForExcludeRules(currentName, 'MyModule/module1');
      result.should.equal(true);
      currentName = 'is!compatibleLayer?optional!MyModule/module1';
      result = checkDependencyForExcludeRules(currentName, 'MyModule/module1');
      result.should.equal(true);
      currentName = 'is!browser?i18n!MyModule/module1';
      result = checkDependencyForExcludeRules(currentName, 'MyModule/module1');
      result.should.equal(true);
      currentName = 'i18n!MyModule/module1';
      result = checkDependencyForExcludeRules(currentName, 'MyModule/module1');
      result.should.equal(true);
   });

   it('get correct moduleInfo for current dependency', () => {
      const modules = [
         {
            name: 'MyModule1',
            path: 'path/to/MyModule1',
            responsible: 'some responsible'
         },
         {
            name: 'MyModule2',
            path: 'path/to/MyModule2',
            responsible: 'some responsible 2'
         }
      ];
      let nodeName = 'optional!MyModule1/module1';
      let result = getModuleInfoForCurrentNode(nodeName, modules);
      (!!result).should.equal(true);
      Object.keys(result).should.have.members(['name', 'path', 'responsible']);
      nodeName = 'thirdParty/myModule1';
      result = getModuleInfoForCurrentNode(nodeName, modules);
      (!!result).should.equal(false);
   });

   it('check dependencies validity: meta nodes has current dependency', async() => {
      const nodeName = 'css!MyModule/module1';
      const result = await isValidDependency(moduleDependencies, nodeName, outputDirectory);
      result.should.equal(true);
   });

   it('check dependencies validity: meta nodes doesn\'t have current dependency, but exists in output', async() => {
      const nodeName = 'css!MyModule/testFileSystemCheck';
      const result = await isValidDependency(moduleDependencies, nodeName, outputDirectory);
      result.should.equal(true);
   });

   it('check dependencies validity: meta nodes doesn\'t have current dependency and doesn\'t exists in output', async() => {
      const nodeName = 'css!MyModule/testNotExistingNode';
      const result = await isValidDependency(moduleDependencies, nodeName, outputDirectory);
      result.should.equal(false);
   });
});
