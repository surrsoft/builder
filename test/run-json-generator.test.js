'use strict';

const initTest = require('./init-test');

const path = require('path'),
   fs = require('fs-extra'),
   runJsonGenerator = require('../lib/i18n/run-json-generator');

const testDirname = path.join(__dirname, 'fixture/run-json-generator');
const outputPath = path.join(testDirname, 'output');

function clear() {
   return fs.remove(outputPath);
}

// просто проверяем, что run-json-generator нормально вызывается.
describe('run json-generator', () => {
   before(async() => {
      await initTest();
   });
   it('tests', async() => {
      let testedOptions, modules, result;

      // пустой список модулей
      await clear();
      modules = [];
      result = await runJsonGenerator(modules, outputPath);
      Object.keys(result.index).length.should.equal(0);
      result.errors.length.should.equal(0);

      // простой тест
      await clear();
      modules = [path.join(testDirname, 'TestModuleWithModuleJs'), path.join(testDirname, 'TestModuleWithoutModuleJs')];
      result = await runJsonGenerator(modules, outputPath);
      result.errors.length.should.equal(0);
      const resultIndex = result.index;
      Object.keys(resultIndex).length.should.equal(2);

      resultIndex.hasOwnProperty('TestModuleWithoutModuleJs/MyComponent').should.equal(true);
      testedOptions = resultIndex['TestModuleWithoutModuleJs/MyComponent'].properties['ws-config'].options;
      testedOptions.caption.translatable.should.equal(true);
      testedOptions.icon.hasOwnProperty('translatable').should.equal(false);

      resultIndex.hasOwnProperty('My.Component').should.equal(true);
      testedOptions = resultIndex['My.Component'].properties['ws-config'].options;
      testedOptions.caption.translatable.should.equal(true);
      testedOptions.icon.hasOwnProperty('translatable').should.equal(false);

      await clear();
   });
});
