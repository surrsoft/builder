'use strict';

const chai = require('chai'),
   helpers = require('../lib/helpers');

chai.should();

describe('helpers', function() {
   it('getFirstDirInRelativePath', () => {
      helpers.getFirstDirInRelativePath('/Test1/test2/').should.equal('Test1');
      helpers.getFirstDirInRelativePath('Test1/test1').should.equal('Test1');
      helpers.getFirstDirInRelativePath('\\Test1\\test2').should.equal('Test1');
      helpers.getFirstDirInRelativePath('').should.equal('');
      helpers.getFirstDirInRelativePath('/../test2/').should.equal('..');
      helpers.getFirstDirInRelativePath('./test2/').should.equal('.');
   });

   it('prettifyPath', () => {

      helpers.prettifyPath('').should.equal('');

      helpers.prettifyPath('\\').should.equal('/');
      helpers.prettifyPath('/').should.equal('/');

      helpers.prettifyPath('\\simple\\').should.equal('/simple/');
      helpers.prettifyPath('/simple/').should.equal('/simple/');

      //helpers.prettifyPath('\\\\simple\\\\dir').should.equal('/simple/dir'); TODO: валилось на windows
      //helpers.prettifyPath('//simple//dir').should.equal('/simple/dir');

      helpers.prettifyPath('C:\\/dir\\/').should.equal('C:/dir/');

      helpers.prettifyPath('C:\\/dir\\/test\\/..').should.equal('C:/dir');

      helpers.prettifyPath('./../Dir').should.equal('../Dir');
   });
});

