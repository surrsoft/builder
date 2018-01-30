'use strict';

const chai = require('chai');

//логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger(require('gulplog'));

const nodeWS = require('../gulpTasks/helpers/node-ws');



let htmlTmpl;

chai.should();

const convertHtmlTmplPromise = (value) => {
   return new Promise((resolve, reject) => {
      htmlTmpl.convertHtmlTmpl(value, '', (error, result) => {
         if (error) {
            reject(error);
         } else {
            resolve(result);
         }
      });
   });

};

describe('html-tmpl', function() {
   it('init', function() {
      let err = nodeWS.init();
      if (err) {
         throw new Error(err);
      }
      htmlTmpl = require('../lib/html-tmpl');
   });
   it('basic', async() => {
      const result = await convertHtmlTmplPromise('<div>{{1+1}}</div>');
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

