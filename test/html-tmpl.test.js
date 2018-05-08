'use strict';

require('./init-test');

const processingTmpl = require('../lib/processing-tmpl');

describe('convert html.tmpl', function() {
   it('basic', async() => {
      const result = await processingTmpl.buildHtmlTmpl('<div>{{1+1}}</div>', '');
      result.includes('<html component="Controls/Application"').should.equal(true);
   });
});
