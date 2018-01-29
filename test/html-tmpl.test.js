'use strict';

const chai = require('chai'),
   nodeWS = require('../gulpTasks/helpers/node-ws'),
   logger = require('../lib/logger').logger;
let htmlTmpl;

chai.should();

const convertHtmlTmplPromise = (value) => {
   return new Promise((resolve, reject) => {
      htmlTmpl.convertHtmlTmpl(value, '', (error, result) => {
         if (error) {
            logger.exception('ERROR', error);
            reject(error);
         }
         resolve(result);
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
   it('button', async() => {
      const result = await convertHtmlTmplPromise('<Controls:Button caption="Привет" />');
      result.should.equal('<div>2</div>');
   });
   it('application', async() => {
      const result = await convertHtmlTmplPromise('<Controls:Application title="Престо" />');
      result.should.equal('<div>2</div>');
   });
});

