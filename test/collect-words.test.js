'use strict';

const chai = require('chai'),
   path = require('path');

//логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger(require('gulplog'));

const nodeWS = require('../gulp/helpers/node-ws');

chai.should();

let collectWords;

describe('transliterate', async() => {
   it('init', () => {
      let err = nodeWS.init();
      if (err) {
         throw new Error(err);
      }
      collectWords = require('../lib/i18n/collect-words');
   });

   it('empty js', async() => {
      const text = '';
      const words = await collectWords('module', 'file.js', text, []);
      words.length.should.equal(0);
   });

   it('empty xhtml', async() => {
      const text = '';
      const words = await collectWords('module', 'file.xhtml', text, []);
      words.length.should.equal(0);
   });

   it('empty tmpl', async() => {
      const text = '';
      const words = await collectWords('module', 'file.tmpl', text, []);
      words.length.should.equal(0);
   });

   it('collect words in js', async() => {
      //TODO: Добавить plural
      const moduleDir = 'long/path/moduleName';
      const filePath = path.join(moduleDir, 'file.js');
      const text = 'function name (){\n' +
         '   return rk(\'Test1\');\n' +
         '}\n' +
         'var testVar = rk(\'Test2\', \'TestContext2\');\n' +
         '//var testVar3 = rk(\'Test3\', \'TestContext3\');\n' +
         '/* var testVar3 = rk(\'Test3\', \'TestContext3\'); */\n';
      const words = await collectWords(moduleDir, filePath, text, []);
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

   it('collect words in xhtml. simple div and span', async() => {
      const moduleDir = 'long/path/moduleName';
      const filePath = path.join(moduleDir, 'file.xhtml');
      const text = '<div>Test1</div><span>TestContext2@@Test2</span><!--<div>Текст3</div><span>Текст4</span>-->';
      const words = await collectWords(moduleDir, filePath, text, []);
      words.length.should.equal(2);

      words[0].ui.should.equal(moduleDir);
      words[0].module.should.equal(filePath);
      words[0].key.should.equal('Test1');
      words[0].context.should.equal('');

      words[1].ui.should.equal(moduleDir);
      words[1].module.should.equal(filePath);
      words[1].key.should.equal('Test2');
      words[1].context.should.equal('TestContext2');
   });

   it('collect words in tmpl. simple div and span', async() => {
      const moduleDir = 'long/path/moduleName';
      const filePath = path.join(moduleDir, 'file.tmpl');
      const text = '<div>Test1</div><span>TestContext2@@Test2</span><!--<div>Текст3</div><span>Текст4</span>-->';
      const words = await collectWords(moduleDir, filePath, text, []);
      words.length.should.equal(2);

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
