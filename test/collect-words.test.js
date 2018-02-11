'use strict';

const chai = require('chai'),
   path = require('path');

//логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger(require('gulplog'));

const nodeWS = require('../gulp/helpers/node-ws');

chai.should();

let collectWords;

describe('collect words', async() => {
   it('init', () => {
      let err = nodeWS.init();
      if (err) {
         throw new Error(err);
      }
      collectWords = require('../lib/i18n/collect-words');
   });

   it('empty js', async() => {
      const text = '';
      const words = await collectWords('module', 'file.js', text, {});
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


   it('empty xhtml and tmpl', async() => {
      const test = async(ext) => {
         const text = '';
         const words = await collectWords('module', 'file.' + ext, text, {});
         words.length.should.equal(0);
      };
      await test('xhtml');
      await test('tmpl');
   });

   //в данном случае можно тестировать xhtml и tmpl одинаково.
   //но выволняется разный код!
   it('collect words in xhtml and tmpl. simple div and span', async() => {
      const test = async(ext) => {
         const moduleDir = 'long/path/moduleName';
         const filePath = path.join(moduleDir, 'file.' + ext);
         const text = '<div>Test1</div><span>TestContext2@@Test2</span><!--<div>Текст3</div><span>Текст4</span>-->';
         const words = await collectWords(moduleDir, filePath, text, {});
         words.length.should.equal(2);

         words[0].ui.should.equal(moduleDir);
         words[0].module.should.equal(filePath);
         words[0].key.should.equal('Test1');
         words[0].context.should.equal('');

         words[1].ui.should.equal(moduleDir);
         words[1].module.should.equal(filePath);
         words[1].key.should.equal('Test2');
         words[1].context.should.equal('TestContext2');
      };
      await test('xhtml');
      await test('tmpl');
   });

   //в данном случае можно тестировать xhtml и tmpl одинаково.
   //но выволняется разный код!
   it('collect words in xhtml and tmpl. title', async() => {
      const test = async(ext) => {
         const moduleDir = 'long/path/moduleName';
         const filePath = path.join(moduleDir, 'file.' + ext);
         const text = '<a href="/" title="Текст1"><a href="/" title="TestContext2@@Текст2">';
         const words = await collectWords(moduleDir, filePath, text, []);

         words.length.should.equal(2);

         words[0].key.should.equal('Текст1');
         words[0].context.should.equal('');

         words[1].key.should.equal('Текст2');
         words[1].context.should.equal('TestContext2');
      };
      await test('xhtml');
      await test('tmpl');
   });

   //несколько видов задания простых опций
   it('collect words in xhtml. simple component option', async () => {
      const moduleDir = 'long/path/moduleName';
      const filePath = path.join(moduleDir, 'file.xhtml');
      const text = '<component data-component="Test.Component">\n' +
         '   <option name="test1">Контекст@@Текст1</option>\n' +
         '   <option name="test2" value="Контекст@@Текст2"></option>\n' +
         '   <opt name="test3">Контекст@@Текст3</opt>\n' +
         '   <opt name="test4" value="Контекст@@Текст4"></opt>\n' +
         '   <option name="not_translatable1" value="Контекст@@Текст5"></option>\n' +
         '   <opt name="not_translatable2" value="Контекст@@Текст6"></opt>\n' +
         '</component>';
      const componentsProperties = {
         'Test.Component': {
            'properties': {
               'ws-config': {
                  'options': {
                     'test1': {
                        'translatable': true
                     },
                     'test2': {
                        'translatable': true
                     },
                     'test3': {
                        'translatable': true
                     },
                     'test4': {
                        'translatable': true
                     }
                  }
               }
            }
         }
      };
      const words = await collectWords(moduleDir, filePath, text, componentsProperties);

      words.length.should.equal(4);

      words[0].key.should.equal('Текст1');
      words[0].context.should.equal('Контекст');

      words[1].key.should.equal('Текст2');
      words[1].context.should.equal('Контекст');

      words[2].key.should.equal('Текст3');
      words[2].context.should.equal('Контекст');

      words[3].key.should.equal('Текст4');
      words[3].context.should.equal('Контекст');

   });

   //опции с версткой - тип content
   it('collect words in xhtml. content component option', async() => {
      const moduleDir = 'long/path/moduleName';
      const filePath = path.join(moduleDir, 'file.xhtml');

      const text = '<component data-component="Test.Component">\n' +
         '   <option name="contentOpt"><div>Контекст@@Текст</div></option>\n' +
         '</component>';
      const componentsProperties = {
         'Test.Component': {
            'properties': {
               'ws-config': {
                  'options': {
                     'contentOpt': {
                        'translatable': true,
                        'type': 'Content'
                     }
                  }
               }
            }
         }
      };
      const words = await collectWords(moduleDir, filePath, text, componentsProperties);

      words.length.should.equal(1);

      words[0].key.should.equal('Текст');
      words[0].context.should.equal('Контекст');
   });

   //опции-массивы
   it('collect words in xhtml. array component option', async() => {
      const moduleDir = 'long/path/moduleName';
      const filePath = path.join(moduleDir, 'file.xhtml');

      const text = '<component data-component="Test.Component">\n' +
         '   <options name="arrayOpt" type="array">' +
         '      <options>' +
         '         <option name="test">Контекст@@Текст</option>' +
         '      </options>' +
         '   </options>\n' +
         '</component>';
      const componentsProperties = {
         'Test.Component': {
            'properties': {
               'ws-config': {
                  'options': {
                     'arrayOpt': {
                        'itemType': 'Items.typedef',
                        'type': 'array'
                     }
                  }
               }
            }
         },
         'Items.typedef': {
            'properties': {
               'ws-config': {
                  'options': {
                     'test': {
                        'translatable': true
                     }
                  }
               }
            }
         }
      };

      const words = await collectWords(moduleDir, filePath, text, componentsProperties);

      words.length.should.equal(0); //TODO: тут ошибка

      //words[0].key.should.equal('Текст');
      //words[0].context.should.equal('Контекст');
   });

   //опции-массивы
   it('collect words in xhtml. WS-EXPERT', async() => {
      const moduleDir = 'long/path/moduleName';
      const filePath = path.join(moduleDir, 'file.xhtml');

      const text = '<div><!--WS-EXPERT' +
         '<component data-component="Test.Component">\n' +
         '   <options name="arrayOpt" type="array">' +
         '      <options>' +
         '         <option name="test">{[Контекст@@Текст1]}</option>' +
         '      </options>' +
         '   </options>\n' +
         '</component>{[Текст2]}' +
         'WS-EXPERT--></div>';
      const words = await collectWords(moduleDir, filePath, text, {});

      words.length.should.equal(2);

      words[0].key.should.equal('Текст1');
      words[0].context.should.equal('Контекст');

      words[1].key.should.equal('Текст2');
      words[1].context.should.equal('');
   });

});
