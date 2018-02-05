'use strict';

const chai = require('chai'),
   helpers = require('../lib/helpers');

chai.should();

describe('helpers', function() {
   it('getFirstDirInRelativePath', async() => {
      helpers.getFirstDirInRelativePath('/Test1/test2/').should.equal('Test1');
      helpers.getFirstDirInRelativePath('Test1/test1').should.equal('Test1');
      helpers.getFirstDirInRelativePath('\\Test1\\test2').should.equal('Test1');
      helpers.getFirstDirInRelativePath('').should.equal('');
      helpers.getFirstDirInRelativePath('/../test2/').should.equal('..');
      helpers.getFirstDirInRelativePath('./test2/').should.equal('.');
   });
});

