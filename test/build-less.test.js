/* eslint-disable promise/prefer-await-to-then*/

'use strict';

require('./init-test');

const chai = require('chai'),
   path = require('path'),
   helpers = require('../lib/helpers'),
   buildLess = require('../lib/build-less');

const expect = chai.expect;

const testPath = helpers.prettifyPath(path.join(__dirname, 'fixture/build-less'));
const resourcesPath = helpers.prettifyPath(path.join(testPath, 'resources'));
const wsPath = helpers.prettifyPath(path.join(resourcesPath, 'ws'));

describe('build less', function() {

   it('empty less', async() => {
      const filePath = path.join(resourcesPath, 'AnyModule/bla/bla/long/path/test.less');
      const text = '';
      const result = await buildLess(filePath, text, resourcesPath);
      result.imports.length.should.equal(2);
      result.text.should.equal('');
   });
   it('less with default theme', async() => {
      const filePath = path.join(resourcesPath, 'AnyModule/bla/bla/long/path/test.less');
      const text = '.test-selector {\n' +
         'test-mixin: @test-mixin;' +
         'test-var: @test-var;' +
         '}';
      const result = await buildLess(filePath, text, resourcesPath);
      result.imports.length.should.equal(2);
      result.text.should.equal('.test-selector {\n' +
         '  test-mixin: \'mixin there\';\n' +
         '  test-var: \'it is online\';\n' +
         '}\n');
   });
   it('less from retail', async() => {
      const filePath = path.join(resourcesPath, 'Retail/bla/bla/long/path/test.less');
      const text = '.test-selector {\n' +
         'test-mixin: @test-mixin;' +
         'test-var: @test-var;' +
         '}';
      const result = await buildLess(filePath, text, resourcesPath);
      result.imports.length.should.equal(2);
      result.text.should.equal('.test-selector {\n' +
         '  test-mixin: \'mixin there\';\n' +
         '  test-var: \'it is carry\';\n}\n');
   });
   it('less from retail with presto theme', async() => {
      const filePath = path.join(resourcesPath, 'Retail/themes/presto/test.less');
      const text = '.test-selector {\n' +
         'test-mixin: @test-mixin;' +
         'test-var: @test-var;' +
         '}';
      const result = await buildLess(filePath, text, resourcesPath);
      result.imports.length.should.equal(2);
      result.text.should.equal('.test-selector {\n' +
         '  test-mixin: \'mixin there\';\n' +
         '  test-var: \'it is presto\';\n}\n');
   });
   it('Button less from SBIS3.CONTROLS', async() => {
      const filePath = path.join(resourcesPath, 'SBIS3.CONTROLS/Button/Button.less');
      const text = '.test-selector {\n' +
         'test-mixin: @test-mixin;' +
         'test-var: @test-var;' +
         '}';
      const result = await buildLess(filePath, text, resourcesPath);
      result.imports.length.should.equal(2);
      result.text.should.equal('.test-selector {\n' +
         '  test-mixin: \'mixin there\';\n' +
         '  test-var: \'it is online\';\n}\n');
   });

   //важно отобразить корректно строку в которой ошибка
   it('less with error', () => {
      const filePath = helpers.prettifyPath(path.join(resourcesPath, 'AnyModule/bla/bla/long/path/test.less'));
      const text = '@import "notExist";';

      const promise = buildLess(filePath, text, resourcesPath);
      return expect(promise).to.be.rejected.then(function(error) {
         //заменяем слеши, иначе не сравнить на linux и windows одинаково
         const errorMessage = error.message.replace(/\\/g, '/');
         return errorMessage.should.equal(
            `Ошибка компиляции ${resourcesPath}/AnyModule/bla/bla/long/path/test.less на строке 1: ` +
            `'notExist.less' wasn't found. Tried - ${resourcesPath}/AnyModule/bla/bla/long/path/notExist.less,notExist.less`);
      });
   });

   it('less with error from SBIS3.CONTROLS', () => {
      const filePath = helpers.prettifyPath(path.join(resourcesPath, 'AnyModule/bla/bla/long/path/test.less'));
      const text = '@import "notExist";';

      const promise = buildLess(filePath, text, resourcesPath);
      return expect(promise).to.be.rejected.then(function(error) {
         //заменяем слеши, иначе не сравнить на linux и windows одинаково
         const errorMessage = error.message.replace(/\\/g, '/');
         return errorMessage.should.equal(
            `Ошибка компиляции ${resourcesPath}/AnyModule/bla/bla/long/path/test.less на строке 1: ` +
            `'notExist.less' wasn't found. Tried - ${resourcesPath}/AnyModule/bla/bla/long/path/notExist.less,notExist.less`);
      });
   });

   it('less with internal error', () => {
      const filePath = helpers.prettifyPath(path.join(resourcesPath, 'AnyModule/test.less'));
      const text = '@import "Error";';

      const promise = buildLess(filePath, text, resourcesPath);
      return expect(promise).to.be.rejected.then(function(error) {
         //заменяем слеши, иначе не сравнить на linux и windows одинаково
         const errorMessage = error.message.replace(/\\/g, '/');
         return errorMessage.should.equal(
            `Ошибка компиляции ${resourcesPath}/AnyModule/Error.less на строке 1: ` +
            `'notExist.less' wasn't found. Tried - ${resourcesPath}/AnyModule/notExist.less,notExist.less`);
      });
   });

   it('variables.less from themes', async() => {
      const filePath = path.join(resourcesPath, 'Retail/themes/presto/variables.less');
      const text = '';
      const result = await buildLess(filePath, text, resourcesPath);
      result.hasOwnProperty('ignoreMessage').should.equal(true);
   });

   it('less from ws', async() => {
      const filePath = path.join(wsPath, 'deprecated/Controls/TabControl/TabControl.less');
      const text = '.test-selector {\n' +
         'test-mixin: @test-mixin;' +
         'test-var: @test-var;' +
         '}';
      const result = await buildLess(filePath, text, resourcesPath);
      result.imports.length.should.equal(2);
      result.text.should.equal('.test-selector {\n' +
         '  test-mixin: \'mixin there\';\n' +
         '  test-var: \'it is online\';\n' +
         '}\n');
   });
});

