'use strict';

const chai = require('chai'),
   nodeWS = require('../gulpTasks/helpers/node-ws');
let htmlTmpl;

chai.should();

const convertHtmlTmplPromise = (value) => {
   return new Promise(resolve => {
      htmlTmpl.convertHtmlTmpl(value, '', result => {
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
});

