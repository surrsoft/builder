'use strict';

//логгер - глобальный
require('../lib/logger').setGulpLogger(require('gulplog'));

const chai = require('chai'),
   chaiAsPromised = require('chai-as-promised'),
   path = require('path'),
   buildLess = require('../lib/build-less');

chai.use(chaiAsPromised);
chai.should();

const testDirname = path.join(__dirname, 'fixture/build-less');

describe('build less', function() {
   it('empty less', async() => {
      const filePath = path.join(testDirname, 'AnyModule/bla/bla/long/path/test.less');
      const text = '';
      const result = await buildLess(filePath, text, testDirname);
      result.length.should.equal(1);
      result[0].fileName.should.equal('test');
      result[0].imports.length.should.equal(2);
      result[0].text.should.equal('');
   });
   it('less with default theme', async() => {
      const filePath = path.join(testDirname, 'AnyModule/bla/bla/long/path/test.less');
      const text = '.test-selector {\n' +
         'test-mixin: @test-mixin;' +
         'test-var: @test-var;' +
         '}';
      const result = await buildLess(filePath, text, testDirname);
      result.length.should.equal(1);
      result[0].fileName.should.equal('test');
      result[0].imports.length.should.equal(2);
      result[0].text.should.equal('.test-selector {\n' +
         '  test-mixin: \'mixin there\';\n' +
         '  test-var: \'it is online\';\n' +
         '}\n');
   });
   it('less from retail', async() => {
      const filePath = path.join(testDirname, 'Retail/bla/bla/long/path/test.less');
      const text = '.test-selector {\n' +
         'test-mixin: @test-mixin;' +
         'test-var: @test-var;' +
         '}';
      const result = await buildLess(filePath, text, testDirname);
      result.length.should.equal(1);
      result[0].fileName.should.equal('test');
      result[0].imports.length.should.equal(2);
      result[0].text.should.equal('.test-selector {\n' +
         '  test-mixin: \'mixin there\';\n' +
         '  test-var: \'it is carry\';\n}\n');
   });
   it('less from retail with presto theme', async() => {
      const filePath = path.join(testDirname, 'Retail/themes/presto/test.less');
      const text = '.test-selector {\n' +
         'test-mixin: @test-mixin;' +
         'test-var: @test-var;' +
         '}';
      const result = await buildLess(filePath, text, testDirname);
      result.length.should.equal(1);
      result[0].fileName.should.equal('test');
      result[0].imports.length.should.equal(2);
      result[0].text.should.equal('.test-selector {\n' +
         '  test-mixin: \'mixin there\';\n' +
         '  test-var: \'it is presto\';\n}\n');
   });
   it('Button less from SBIS3.CONTROLS', async() => {
      const filePath = path.join(testDirname, 'SBIS3.CONTROLS/Button/Button.less');
      const text = '.test-selector {\n' +
         'test-mixin: @test-mixin;' +
         'test-var: @test-var;' +
         '}';
      const result = await buildLess(filePath, text, testDirname);

      const themes = ['online', 'carry', 'presto', 'carrynew', 'prestonew'];
      const fileNamesForTheme = {
         'online': 'Button',
         'carry': 'Button__carry',
         'presto': 'Button__presto',
         'carrynew': 'Button__carrynew',
         'prestonew': 'Button__prestonew'
      };
      result.length.should.equal(themes.length);

      for (let i = 0; i < themes.length; i++) {
         result[i].fileName.should.equal(fileNamesForTheme[themes[i]]);
         result[i].imports.length.should.equal(2);
         result[i].text.should.equal('.test-selector {\n' +
            '  test-mixin: \'mixin there\';\n' +
            `  test-var: \'it is ${themes[i]}\';\n}\n`);
      }
   });
   it('less with error', async() => {
      //строка, где произошла ошибка определяется не корректно из-за добавляемых импортов
      const filePath = path.join(testDirname, 'AnyModule/bla/bla/long/path/test.less');
      const text = '@import "notExist";';
      return buildLess(filePath, text, testDirname).should.be.rejectedWith(
         `Ошибка компиляции ${testDirname}/AnyModule/bla/bla/long/path/test.less на строке 4: ` +
         `'notExist.less' wasn't found. Tried - ${testDirname}/AnyModule/bla/bla/long/path/notExist.less,notExist.less`);

   });
   it('less with error from SBIS3.CONTROLS', async() => {
      const filePath = path.join(testDirname, 'AnyModule/bla/bla/long/path/test.less');
      const text = '@import "notExist";';
      return buildLess(filePath, text, testDirname).should.be.rejectedWith(
         `Ошибка компиляции ${testDirname}/AnyModule/bla/bla/long/path/test.less на строке 4: ` +
         `'notExist.less' wasn't found. Tried - ${testDirname}/AnyModule/bla/bla/long/path/notExist.less,notExist.less`);

   });
   it('less with internal error', async() => {
      const filePath = path.join(testDirname, 'AnyModule/test.less');
      const text = '@import "Error";';
      return buildLess(filePath, text, testDirname).should.be.rejectedWith(
         `Ошибка компиляции ${testDirname}/AnyModule/Error.less на строке 1: ` +
         `'notExist.less' wasn't found. Tried - ${testDirname}/AnyModule/notExist.less,notExist.less`);

   });

});

