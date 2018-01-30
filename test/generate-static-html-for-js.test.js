'use strict';

const chai = require('chai'),
   path = require('path');

//логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger(require('gulplog'));

const helpers = require('../lib/helpers'),
   generateStaticHtmlForJs = require('../lib/generate-static-html-for-js');

chai.should();

const moduleText = 'define("MyModule", [], function(){' +
   'var C; ' +
   'C.webPage={' +
   'htmlTemplate:"Тема Скрепка/%filename%",' +
   'outFileName:"reclamations", ' +
   'title:"test_title"};' +
   'return C;});';

const config = {
   root: path.join(__dirname, 'fixture/generate-static-html-for-js'),
   application: '/',
   applicationRoot: path.join(__dirname, 'fixture/generate-static-html-for-js'),
   servicesPath: '/service/',
   userParams: true,
   globalParams: false
};


describe('generate static html for js', function() {
   it('empty', async() => {
      const ast = helpers.parseModule(moduleText.replace(/%filename%/g, 'empty.html'));
      const contents = {};
      const result = await generateStaticHtmlForJs(ast, contents, config, false);
      result.outputPath.should.equal(path.join(__dirname, 'fixture/generate-static-html-for-js/reclamations.html'));
      result.text.should.equal('\r\n\r\n\r\n');
   });
   it('flags', async() => {
      const ast = helpers.parseModule(moduleText.replace(/%filename%/g, 'flags.html'));
      const contents = {};
      const result = await generateStaticHtmlForJs(ast, contents, config, false);
      result.outputPath.should.equal(path.join(__dirname, 'fixture/generate-static-html-for-js/reclamations.html'));
      result.text.should.equal('true\r\n' +
         'false\r\n' +
         'false\r\n');
   });
   it('includes', async() => {
      const ast = helpers.parseModule(moduleText.replace(/%filename%/g, 'includes.html'));
      const contents = {};
      const result = await generateStaticHtmlForJs(ast, contents, config, false);
      result.outputPath.should.equal(path.join(__dirname, 'fixture/generate-static-html-for-js/reclamations.html'));
      result.text.should.equal('<INCLUDE1/>\n\r\n' +
         '<INCLUDE2/>\n\r\n');
   });
   it('paths', async() => {
      const ast = helpers.parseModule(moduleText.replace(/%filename%/g, 'paths.html'));
      const contents = {};
      const result = await generateStaticHtmlForJs(ast, contents, config, false);
      result.outputPath.should.equal(path.join(__dirname, 'fixture/generate-static-html-for-js/reclamations.html'));
      result.text.should.equal('RESOURCE_ROOT:/resources/\r\n' +
         'WI.SBIS_ROOT:/ws/\r\n' +
         'APPLICATION_ROOT:/\r\n' +
         'SERVICES_PATH:/service/\r\n');
   });
   it('title', async() => {
      const ast = helpers.parseModule(moduleText.replace(/%filename%/g, 'title.html'));
      const contents = {};
      const result = await generateStaticHtmlForJs(ast, contents, config, false);
      result.outputPath.should.equal(path.join(__dirname, 'fixture/generate-static-html-for-js/reclamations.html'));
      result.text.should.equal('TITLE:\r\n');
   });
});
