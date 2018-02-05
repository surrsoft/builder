'use strict';

//логгер - глобальный
require('../lib/logger').setGulpLogger(require('gulplog'));

const chai = require('chai'),
   buildLess = require('../lib/build-less');

chai.should();

describe('build less', function() {
   it('empty', async() => {
      const result = await buildLess('virtualFile', '', '');
      Object.getOwnPropertyNames(result).length.should.equal(2);
   });
});

