'use strict';

const chai = require('chai'),
   transliterate = require('../lib/transliterate');

chai.should();

describe('utils', function() {
   describe('transliterate', function() {
      it('lower_case', function() {
         transliterate('тест').should.equal('test');
      });
      it('upper_case', function() {
         transliterate('ТЕСТ').should.equal('TEST');
      });
      it('tricky_chars', function() {
         transliterate('Я я').should.equal('YA_ya');
         transliterate('Ъ ъ').should.equal('_');
         transliterate('Ь ь').should.equal('_');
         transliterate('Ё ё').should.equal('E_e');
         transliterate('Ю ю').should.equal('YU_yu');
         transliterate('Щ щ').should.equal('SCH_sch');
         transliterate('Й й').should.equal('J_j');
      });
      it('english_with_punctuation', function() {
         transliterate('Simple.Test').should.equal('Simple.Test');
      });
   });
});
