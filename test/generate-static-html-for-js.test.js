'use strict';

const chai = require('chai'),
   path = require('path');

//логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger(require('gulplog'));

const helpers = require('../lib/helpers'),
   generateStaticHtmlForJs = require('../lib/generate-static-html-for-js');

const should = chai.should();

const moduleWithWebPage = 'define("MyModule", [], function(){' +
   'var C; ' +
   'C.webPage={' +
   'htmlTemplate:"Тема Скрепка/%filename%",' +
   'outFileName:"reclamations", ' +
   'title:"test_title"};' +
   'return C;});';

const moduleWithoutWebPage = 'define("MyModule2", [], function(){' +
   'var C; ' +
   'C.title="test_title";' +
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
   describe('module with web page', function() {
      it('empty', async() => {
         const ast = helpers.parseModule(moduleWithWebPage.replace(/%filename%/g, 'empty.html'));
         const contents = {};
         const result = await generateStaticHtmlForJs(ast, contents, config, false);
         contents.htmlNames['MyModule'].should.equal('reclamations.html');
         result.outputPath.should.equal(path.join(__dirname, 'fixture/generate-static-html-for-js/reclamations.html'));
         result.text.should.equal('\n\n\n');
      });
      it('flags', async() => {
         const ast = helpers.parseModule(moduleWithWebPage.replace(/%filename%/g, 'flags.html'));
         const contents = {};
         const result = await generateStaticHtmlForJs(ast, contents, config, false);
         contents.htmlNames['MyModule'].should.equal('reclamations.html');
         result.outputPath.should.equal(path.join(__dirname, 'fixture/generate-static-html-for-js/reclamations.html'));
         result.text.should.equal('true\n' +
            'false\n' +
            'false\n');
      });
      it('includes', async() => {
         const ast = helpers.parseModule(moduleWithWebPage.replace(/%filename%/g, 'includes.html'));
         const contents = {};
         const result = await generateStaticHtmlForJs(ast, contents, config, false);
         contents.htmlNames['MyModule'].should.equal('reclamations.html');
         result.outputPath.should.equal(path.join(__dirname, 'fixture/generate-static-html-for-js/reclamations.html'));
         result.text.should.equal('<INCLUDE1/>\n\n' +
            '<INCLUDE2/>\n\n');
      });
      it('paths', async() => {
         const ast = helpers.parseModule(moduleWithWebPage.replace(/%filename%/g, 'paths.html'));
         const contents = {};
         const result = await generateStaticHtmlForJs(ast, contents, config, false);
         contents.htmlNames['MyModule'].should.equal('reclamations.html');
         result.outputPath.should.equal(path.join(__dirname, 'fixture/generate-static-html-for-js/reclamations.html'));
         result.text.should.equal('RESOURCE_ROOT:/resources/\n' +
            'WI.SBIS_ROOT:/ws/\n' +
            'APPLICATION_ROOT:/\n' +
            'SERVICES_PATH:/service/\n');
      });
      it('title', async() => {
         const ast = helpers.parseModule(moduleWithWebPage.replace(/%filename%/g, 'title.html'));
         const contents = {};
         const result = await generateStaticHtmlForJs(ast, contents, config, false);
         contents.htmlNames['MyModule'].should.equal('reclamations.html');
         result.outputPath.should.equal(path.join(__dirname, 'fixture/generate-static-html-for-js/reclamations.html'));
         result.text.should.equal('TITLE:\n');
      });
   });

   describe('module without web page', function() {
      it('empty', async() => {
         const ast = helpers.parseModule(moduleWithoutWebPage.replace(/%filename%/g, 'empty.html'));
         const contents = {};
         const result = await generateStaticHtmlForJs(ast, contents, config, false);
         should.not.exist(result);

      });
      it('flags', async() => {
         const ast = helpers.parseModule(moduleWithoutWebPage.replace(/%filename%/g, 'flags.html'));
         const contents = {};
         const result = await generateStaticHtmlForJs(ast, contents, config, false);
         should.not.exist(result);
      });
      it('includes', async() => {
         const ast = helpers.parseModule(moduleWithoutWebPage.replace(/%filename%/g, 'includes.html'));
         const contents = {};
         const result = await generateStaticHtmlForJs(ast, contents, config, false);
         should.not.exist(result);
      });
      it('paths', async() => {
         const ast = helpers.parseModule(moduleWithoutWebPage.replace(/%filename%/g, 'paths.html'));
         const contents = {};
         const result = await generateStaticHtmlForJs(ast, contents, config, false);
         should.not.exist(result);
      });
      it('title', async() => {
         const ast = helpers.parseModule(moduleWithoutWebPage.replace(/%filename%/g, 'title.html'));
         const contents = {};
         const result = await generateStaticHtmlForJs(ast, contents, config, false);
         should.not.exist(result);
      });
   });
});
