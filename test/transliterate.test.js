'use strict';

require('./init-test');

const transliterate = require('../lib/transliterate');

describe('transliterate', function() {
   it('lower case', function() {
      transliterate('тест').should.equal('test');
   });
   it('upper case', function() {
      transliterate('ТЕСТ').should.equal('TEST');
   });
   it('tricky chars', function() {
      transliterate('Я я').should.equal('YA_ya');
      transliterate('Ъ ъ').should.equal('_');
      transliterate('Ь ь').should.equal('_');
      transliterate('Ё ё').should.equal('E_e');
      transliterate('Ю ю').should.equal('YU_yu');
      transliterate('Щ щ').should.equal('SCH_sch');
      transliterate('Й й').should.equal('J_j');
   });
   it('english with punctuation', function() {
      transliterate('Simple.Test').should.equal('Simple.Test');
   });
});
