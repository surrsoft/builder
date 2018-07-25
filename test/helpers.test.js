'use strict';

const initTest = require('./init-test');

const helpers = require('../lib/helpers');

describe('helpers', () => {
   before(async() => {
      await initTest();
   });

   it('getFirstDirInRelativePath', () => {
      helpers.getFirstDirInRelativePath('/Test1/test2/').should.equal('Test1');
      helpers.getFirstDirInRelativePath('Test1/test1').should.equal('Test1');
      helpers.getFirstDirInRelativePath('\\Test1\\test2').should.equal('Test1');
      helpers.getFirstDirInRelativePath('').should.equal('');
      helpers.getFirstDirInRelativePath('/../test2/').should.equal('..');
      helpers.getFirstDirInRelativePath('./test2/').should.equal('.');
   });

   it('prettifyPath', () => {
      const isWin = process.platform === 'win32';

      helpers.prettifyPath('').should.equal('');

      helpers.prettifyPath('\\').should.equal('/');
      helpers.prettifyPath('/').should.equal('/');

      helpers.prettifyPath('\\simple\\').should.equal('/simple/');
      helpers.prettifyPath('/simple/').should.equal('/simple/');

      // на windows пути, которые начинаются с \\, являются сетевыми и требуют особой обработки
      helpers
         .prettifyPath('\\\\simple\\\\file.less')
         .should.equal(isWin ? '\\\\simple\\file.less' : '/simple/file.less');
      helpers.prettifyPath('\\\\simple/file.less').should.equal(isWin ? '\\\\simple\\file.less' : '/simple/file.less');

      // jinnee-utility может передавать не правильно сетевые пути до файлов. нужно обработать
      helpers.prettifyPath('//simple\\\\file.less').should.equal(isWin ? '\\\\simple\\file.less' : '/simple/file.less');

      helpers.prettifyPath('C:\\/dir\\/').should.equal('C:/dir/');
      helpers.prettifyPath('./../Dir').should.equal('../Dir');
   });
});
