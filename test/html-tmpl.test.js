'use strict';

const chai = require('chai');

//логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger(require('gulplog'));

const nodeWS = require('../gulp/helpers/node-ws');

let convertHtmlTmpl;

chai.should();

describe('convert html.tmpl', function() {
   it('init', function() {
      nodeWS.init();
      convertHtmlTmpl = require('../lib/convert-html-tmpl');
   });
   it('basic', async() => {
      const result = await convertHtmlTmpl.generateMarkup('<div>{{1+1}}</div>');
      result.should.equal('<div>2</div>');
   });

   /* TODO: не работает :(
   it('button', async() => {
      const result = await convertHtmlTmplPromise('<Controls:Button caption="Привет" />');
      result.should.equal('<div>2</div>');
   });
   it('application', async() => {
      const result = await convertHtmlTmplPromise('<Controls:Application title="Престо" />');
      result.should.equal('<div>2</div>');
   });
   */
});

