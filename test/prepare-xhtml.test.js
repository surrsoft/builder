'use strict';

const chai = require('chai');
chai.should();

//логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger(require('gulplog'));
const nodeWS = require('../gulp/helpers/node-ws');
let prepareXhtml;

describe('i18n', function() {
   describe('init', () => {
      let err = nodeWS.init();
      if (err) {
         throw new Error(err);
      }
      prepareXhtml = require('../lib/i18n/prepare-xhtml');
   });
   describe('prepare XHTML', function() {
      it('empty file', () => {
         const result = prepareXhtml('', {});
         result.should.equal('');
      });
      it('simple div', () => {
         const text = '<div>Текст</div>';
         const result = prepareXhtml(text, {});
         result.should.equal('<div>{[Текст]}</div>');
      });
      it('simple a title', () => {
         const text = '<a href="/" title="Текст">';
         const result = prepareXhtml(text, {});
         result.should.equal('<a href="/" title="{[Текст]}">');
      });
      it('simple component option', () => {
         const text = '<component data-component="Test.Component">\n' +
            '   <option name="test1">Текст1</option>\n' +
            '   <option name="test2" value="Текст2"></option>\n' +
            '   <opt name="test3">Текст3</opt>\n' +
            '   <opt name="test4" value="Текст4"></opt>\n' +
            '   <option name="not_translatable1" value="Текст5"></option>\n' +
            '   <opt name="not_translatable2" value="Текст6"></opt>\n' +
            '</component>';
         const componentsProperties = {
            'Test.Component': {
               'properties': {
                  'ws-config': {
                     'options':{
                        'test1':{
                           'translatable': true
                        },
                        'test2':{
                           'translatable': true
                        },
                        'test3':{
                           'translatable': true
                        },
                        'test4':{
                           'translatable': true
                        }
                     }
                  }
               }
            }
         };
         const result = prepareXhtml(text, componentsProperties);
         result.should.equal('<component data-component="Test.Component">\n' +
            '   <option name="test1">{[Текст1]}</option>\n' +
            '   <option name="test2" value="{[Текст2]}"></option>\n' +
            '   <opt name="test3">{[Текст3]}</opt>\n' +
            '   <opt name="test4" value="{[Текст4]}"></opt>\n' +
            '   <option name="not_translatable1" value="Текст5"></option>\n' +
            '   <opt name="not_translatable2" value="Текст6"></opt>\n' +
            '</component>');
      });
   });
});
