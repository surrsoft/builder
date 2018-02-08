'use strict';

//логгер - глобальный
require('../lib/logger').setGulpLogger(require('gulplog'));

const chai = require('chai'),
   chaiAsPromised = require('chai-as-promised'),
   path = require('path'),
   fs = require('fs-extra'),
   mkdirp = require('mkdirp'),
   runJsonGenerator = require('../lib/i18n/run-json-generator');

chai.use(chaiAsPromised);
chai.should();

const testDirname = path.join(__dirname, 'fixture/run-json-generator');
const outputPath = path.join(testDirname, 'output');

function clear() {
   fs.removeSync(outputPath);
}

function writeModulesListToFile(modules) {
   mkdirp.sync(outputPath);
   const modulesJsonPath = path.join(outputPath, 'modules.json');
   fs.writeFileSync(modulesJsonPath, JSON.stringify(modules));
   return modulesJsonPath;
}

describe('run json-generator', function() {
   it('tests', async() => {
      let options,
         modulesJsonPath,
         result;

      //пустой список модулей
      clear();
      modulesJsonPath = writeModulesListToFile([]);
      result = await runJsonGenerator(modulesJsonPath, outputPath);
      Object.keys(result).length.should.equal(0);

      //простой тест
      clear();
      modulesJsonPath = writeModulesListToFile([
         path.join(testDirname, 'TestModuleWithModuleJs'),
         path.join(testDirname, 'TestModuleWithoutModuleJs')
      ]);
      result = await runJsonGenerator(modulesJsonPath, outputPath);
      Object.keys(result).length.should.equal(4); //это бага, что в result получается в два раза больше записей, чем нужно

      result.hasOwnProperty('TestModuleWithoutModuleJs/MyComponent').should.equal(true);
      options = result['TestModuleWithoutModuleJs/MyComponent'].properties['ws-config'].options;
      options.caption.translatable.should.equal(true);
      options.icon.hasOwnProperty('translatable').should.equal(false);

      result.hasOwnProperty('My.Component').should.equal(true);
      options = result['My.Component'].properties['ws-config'].options;
      options.caption.translatable.should.equal(true);
      options.icon.hasOwnProperty('translatable').should.equal(false);

      clear();
   });
});

