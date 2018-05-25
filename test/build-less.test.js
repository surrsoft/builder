/* eslint-disable promise/prefer-await-to-then */

'use strict';

require('./init-test');

const chai = require('chai'),
   path = require('path'),
   lib = require('./lib'),
   helpers = require('../lib/helpers'),
   buildLess = require('../lib/build-less');

const expect = chai.expect;

const workspaceFolder = helpers.prettifyPath(path.join(__dirname, 'fixture/build-less')),
   wsPath = helpers.prettifyPath(path.join(workspaceFolder, 'ws')),
   anyModulePath = path.join(workspaceFolder, 'AnyModule'),
   sbis3ControlsPath = path.join(workspaceFolder, 'SBIS3.CONTROLS'),
   pathsForImport = [workspaceFolder];

describe('build less', () => {
   it('empty less', async() => {
      const filePath = path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less');
      const text = '';
      const result = await buildLess(filePath, text, anyModulePath, sbis3ControlsPath, pathsForImport);
      result.imports.length.should.equal(2);
      result.text.should.equal('');
   });
   it('less with default theme', async() => {
      const filePath = path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const result = await buildLess(filePath, text, anyModulePath, sbis3ControlsPath, pathsForImport);
      result.imports.length.should.equal(2);
      result.text.should.equal(
         ".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is online';\n}\n"
      );
   });
   it('less from retail', async() => {
      const retailModulePath = path.join(workspaceFolder, 'Retail');
      const filePath = path.join(retailModulePath, 'bla/bla/long/path/test.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const result = await buildLess(filePath, text, retailModulePath, sbis3ControlsPath, pathsForImport);
      result.imports.length.should.equal(2);
      result.text.should.equal(
         ".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is carry';\n}\n"
      );
   });
   it('less from retail with presto theme', async() => {
      const retailModulePath = path.join(workspaceFolder, 'Retail');
      const filePath = path.join(retailModulePath, 'themes/presto/test.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const result = await buildLess(filePath, text, retailModulePath, sbis3ControlsPath, pathsForImport);
      result.imports.length.should.equal(2);
      result.text.should.equal(
         ".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is presto';\n}\n"
      );
   });
   it('Button less from SBIS3.CONTROLS', async() => {
      const filePath = path.join(workspaceFolder, 'SBIS3.CONTROLS/Button/Button.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const result = await buildLess(filePath, text, sbis3ControlsPath, sbis3ControlsPath, pathsForImport);
      result.imports.length.should.equal(2);
      result.text.should.equal(
         ".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is online';\n}\n"
      );
   });

   // важно отобразить корректно строку в которой ошибка
   it('less with error', () => {
      const filePath = helpers.prettifyPath(path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less'));
      const text = '@import "notExist";';

      const promise = buildLess(filePath, text, anyModulePath, sbis3ControlsPath, pathsForImport);
      return expect(promise).to.be.rejected.then((error) => {
         // заменяем слеши, иначе не сравнить на linux и windows одинаково
         const errorMessage = error.message.replace(/\\/g, '/');
         return lib
            .trimLessError(errorMessage)
            .should.equal(
               `Ошибка компиляции ${workspaceFolder}/AnyModule/bla/bla/long/path/test.less на строке 1: ` +
                  "'notExist' wasn't found."
            );
      });
   });

   it('less with error from SBIS3.CONTROLS', () => {
      const filePath = helpers.prettifyPath(path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less'));
      const text = '@import "notExist";';

      const promise = buildLess(filePath, text, anyModulePath, sbis3ControlsPath, pathsForImport);
      return expect(promise).to.be.rejected.then((error) => {
         // заменяем слеши, иначе не сравнить на linux и windows одинаково
         const errorMessage = error.message.replace(/\\/g, '/');
         return lib
            .trimLessError(errorMessage)
            .should.equal(
               `Ошибка компиляции ${workspaceFolder}/AnyModule/bla/bla/long/path/test.less на строке 1: ` +
                  "'notExist' wasn't found."
            );
      });
   });

   it('less with internal error', () => {
      const filePath = helpers.prettifyPath(path.join(workspaceFolder, 'AnyModule/test.less'));
      const text = '@import "Error";';

      const promise = buildLess(filePath, text, anyModulePath, sbis3ControlsPath, pathsForImport);
      return expect(promise).to.be.rejected.then((error) => {
         // заменяем слеши, иначе не сравнить на linux и windows одинаково
         const errorMessage = error.message.replace(/\\/g, '/');
         return lib
            .trimLessError(errorMessage)
            .should.equal(
               `Ошибка компиляции ${workspaceFolder}/AnyModule/Error.less на строке 1: 'notExist' wasn't found.`
            );
      });
   });

   it('variables.less from themes', async() => {
      const retailModulePath = path.join(workspaceFolder, 'Retail');
      const filePath = path.join(retailModulePath, 'themes/presto/_variables.less');
      const text = '';
      const result = await buildLess(filePath, text, retailModulePath, sbis3ControlsPath, pathsForImport);
      result.hasOwnProperty('ignoreMessage').should.equal(true);
   });

   it('less from ws', async() => {
      const filePath = path.join(wsPath, 'deprecated/Controls/TabControl/TabControl.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const result = await buildLess(filePath, text, wsPath, sbis3ControlsPath, pathsForImport);
      result.imports.length.should.equal(2);
      result.text.should.equal(
         ".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is online';\n}\n"
      );
   });
});
