'use strict';

require('./init-test');

const path = require('path'),
   fs = require('fs-extra'),
   mkdirp = require('mkdirp'),
   runJsonGenerator = require('../lib/i18n/run-json-generator');

const testDirname = path.join(__dirname, 'fixture/run-json-generator');
const outputPath = path.join(testDirname, 'output');

function clear() {
   return fs.remove(outputPath);
}

async function writeModulesListToFile(modules) {
   mkdirp.sync(outputPath);
   const modulesJsonPath = path.join(outputPath, 'modules.json');
   await fs.writeFile(modulesJsonPath, JSON.stringify(modules));
   return modulesJsonPath;
}

//просто проверяем, что run-json-generator нормально вызывается.
describe('run json-generator', function() {
   it('tests', async() => {
      let options,
         modulesJsonPath,
         result;

      //пустой список модулей
      await clear();
      modulesJsonPath = await writeModulesListToFile([]);
      result = await runJsonGenerator(modulesJsonPath, outputPath);
      Object.keys(result.index).length.should.equal(0);
      result.errors.length.should.equal(0);

      //простой тест
      await clear();
      modulesJsonPath = await writeModulesListToFile([
         path.join(testDirname, 'TestModuleWithModuleJs'),
         path.join(testDirname, 'TestModuleWithoutModuleJs')
      ]);
      result = await runJsonGenerator(modulesJsonPath, outputPath);
      result.errors.length.should.equal(0);
      const resultIndex = result.index;
      Object.keys(resultIndex).length.should.equal(2);

      resultIndex.hasOwnProperty('TestModuleWithoutModuleJs/MyComponent').should.equal(true);
      options = resultIndex['TestModuleWithoutModuleJs/MyComponent'].properties['ws-config'].options;
      options.caption.translatable.should.equal(true);
      options.icon.hasOwnProperty('translatable').should.equal(false);

      resultIndex.hasOwnProperty('My.Component').should.equal(true);
      options = resultIndex['My.Component'].properties['ws-config'].options;
      options.caption.translatable.should.equal(true);
      options.icon.hasOwnProperty('translatable').should.equal(false);

      await clear();
   });
});

