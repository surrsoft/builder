'use strict';

const chai = require('chai'),
   path = require('path');

//логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger(require('gulplog'));

const nodeWS = require('../gulp/helpers/node-ws');

chai.should();

let collectWords;

describe('transliterate', function() {
   it('init', function() {
      let err = nodeWS.init();
      if (err) {
         throw new Error(err);
      }
      collectWords = require('../lib/i18n/collect-words');
   });

   it('empty js', function() {
      const text = '';
      const words = collectWords('module', 'file.js', text, []);
      words.length.should.equal(0);
   });

   it('collect words in js', function() {
      //TODO: Добавить plural
      const moduleDir = 'long/path/moduleName';
      const filePath = path.join(moduleDir, 'file.js');
      const text = 'function name (){\n' +
         '   return rk(\'Test1\');\n' +
         '}\n' +
         'var testVar = rk(\'Test2\', \'TestContext2\');\n' +
         '//var testVar3 = rk(\'Test3\', \'TestContext3\');\n' +
         '/* var testVar3 = rk(\'Test3\', \'TestContext3\'); */\n';
      const words = collectWords(moduleDir, filePath, text, []);
      words.length.should.equal(4); //TODO: очевидно, тут ошибка. должно быть 2

      words[0].ui.should.equal(moduleDir);
      words[0].module.should.equal(filePath);
      words[0].key.should.equal('Test1');
      words[0].context.should.equal('');

      words[1].ui.should.equal(moduleDir);
      words[1].module.should.equal(filePath);
      words[1].key.should.equal('Test2');
      words[1].context.should.equal('TestContext2');
   });
});
