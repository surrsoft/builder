'use strict';

require('./init-test');

const convertHtmlTmpl = require('../lib/convert-html-tmpl'),
   tclosure = global.requirejs('View/Runner/tclosure');

describe('convert html.tmpl', function() {

   it('basic', async() => {
      const func = await convertHtmlTmpl.generateFunction('<div>{{1+1}}</div>');
      const result = func.tmplFunc({}, {}, undefined, false, undefined, tclosure); //eslint-disable-line no-undefined
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

