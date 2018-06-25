'use strict';

require('./init-test');

const chai = require('chai'),
   parseJsComponent = require('../lib/parse-js-component');

const { expect } = chai;

describe('parse js component', () => {
   it('empty file', () => {
      const result = parseJsComponent('');
      Object.getOwnPropertyNames(result).length.should.equal(0);
   });
   it('file with error', () => {
      expect(() => {
         parseJsComponent('define(');
      }).to.throw('Line 1: Unexpected end of input');
   });
   it('empty module name', () => {
      const result = parseJsComponent('define(function(){});');
      Object.getOwnPropertyNames(result).length.should.equal(0);
   });
   it('normal module name', () => {
      const result = parseJsComponent('define("My.Module/Name", function(){});');
      Object.getOwnPropertyNames(result).length.should.equal(1);
      result.componentName.should.equal('My.Module/Name');
      result.hasOwnProperty('isNavigation').should.equal(false);
   });
   it('declare object webpage', () => {
      const result = parseJsComponent(
         'define("My.Module/Name", function(){' +
            'let module;' +
            'module.webPage = {' +
            '   htmlTemplate: "\\\\Тема Скрепка\\\\Шаблоны\\\\empty-template.html",' +
            '   title: "TestTitle",' +
            '   outFileName: "ca_stub",' +
            '   trash:"trash"' +
            '};' +
            'return module;});'
      );
      Object.getOwnPropertyNames(result).length.should.equal(2);
      result.componentName.should.equal('My.Module/Name');
      result.hasOwnProperty('isNavigation').should.equal(false);
      const { webPage } = result;
      Object.getOwnPropertyNames(webPage).length.should.equal(3);
      webPage.htmlTemplate.should.equal('\\Тема Скрепка\\Шаблоны\\empty-template.html');
      webPage.outFileName.should.equal('ca_stub');
   });

   it('declare title and web page', () => {
      const result = parseJsComponent(
         'define("My.Module/Name", function(){' +
            'let module;' +
            'module.webPage = {' +
            '   htmlTemplate: "\\\\Тема Скрепка\\\\Шаблоны\\\\empty-template.html",' +
            '   outFileName: "ca_stub",' +
            '   trash:"trash"' +
            '};' +
            'module.title = "TestTitle";' +
            'return module;});'
      );
      Object.getOwnPropertyNames(result).length.should.equal(2);
      result.componentName.should.equal('My.Module/Name');
      result.hasOwnProperty('isNavigation').should.equal(false);
      const { webPage } = result;
      Object.getOwnPropertyNames(webPage).length.should.equal(3);
      webPage.htmlTemplate.should.equal('\\Тема Скрепка\\Шаблоны\\empty-template.html');
      webPage.title.should.equal('TestTitle');
      webPage.outFileName.should.equal('ca_stub');
   });

   it('declare tricky web page', () => {
      const result = parseJsComponent(
         'define("My.Module/Name", function(){' +
            'let module;' +
            'module.webPage = {};' +
            'module.webPage.htmlTemplate = "\\\\Тема Скрепка\\\\Шаблоны\\\\empty-template.html";' +
            'module.webPage.title = "Пожалуйста, подождите...";' +
            'module.webPage.outFileName = "ca_stub";' +
            'return module;});'
      );
      Object.getOwnPropertyNames(result).length.should.equal(2);
      result.componentName.should.equal('My.Module/Name');
      result.hasOwnProperty('isNavigation').should.equal(false);
      const { webPage } = result;

      // теоритически это должно работать. но мы сознательно это не поддерживаем сейчас, поэтому webPage - пустой
      Object.getOwnPropertyNames(webPage).length.should.equal(0);
   });

   it('declare webpage with custom urls', () => {
      const result = parseJsComponent(
         'define("My.Module/Name", function(){' +
         'let module;' +
         'module.webPage = {' +
         '   htmlTemplate: "\\\\Тема Скрепка\\\\Шаблоны\\\\empty-template.html",' +
         '   title: "TestTitle",' +
         '   outFileName: "ca_stub",' +
         '   trash:"trash",' +
         '   urls: ["url/one", "/urlTwo"]' +
         '};' +
         'return module;});'
      );
      Object.getOwnPropertyNames(result).length.should.equal(2);
      result.componentName.should.equal('My.Module/Name');
      result.hasOwnProperty('isNavigation').should.equal(false);
      const { webPage } = result;
      Object.getOwnPropertyNames(webPage).length.should.equal(4);
      webPage.htmlTemplate.should.equal('\\Тема Скрепка\\Шаблоны\\empty-template.html');
      webPage.outFileName.should.equal('ca_stub');
      webPage.urls.length.should.equal(2);
      webPage.urls.should.have.members(['url/one', '/urlTwo']);
   });

   it('declare dependencies module', () => {
      const result = parseJsComponent('define("My.Module/Name", ["My.Dep/Name1", "My.Dep/Name2"], function(){});');
      Object.getOwnPropertyNames(result).length.should.equal(3);
      result.componentDep.should.have.members(['My.Dep/Name1', 'My.Dep/Name2']);
      result.hasOwnProperty('isNavigation').should.equal(true);
      result.isNavigation.should.equal(false);
   });
   it('declare dependencies module, empty name', () => {
      const result = parseJsComponent('define(["My.Dep/Name1", "My.Dep/Name2"], function(){});');
      Object.getOwnPropertyNames(result).length.should.equal(1);
      result.componentDep.should.have.members(['My.Dep/Name1', 'My.Dep/Name2']);
      result.hasOwnProperty('isNavigation').should.equal(false);
   });
   it('declare empty dependencies module', () => {
      const result = parseJsComponent('define("My.Module/Name", [], function(){});');
      Object.getOwnPropertyNames(result).length.should.equal(3);
      result.componentDep.should.have.members([]);
      result.hasOwnProperty('isNavigation').should.equal(true);
      result.isNavigation.should.equal(false);
   });
   it('declare empty dependencies module №2', () => {
      const result = parseJsComponent('define("My.Module/Name", function(){});');
      Object.getOwnPropertyNames(result).length.should.equal(1);
      result.hasOwnProperty('isNavigation').should.equal(false);
   });
   it('declare navigation', () => {
      let result = parseJsComponent('define("My.Module/Name", ["js!SBIS3.NavigationController"], function(){});');
      result.hasOwnProperty('isNavigation').should.equal(true);
      result.isNavigation.should.equal(true);

      result = parseJsComponent('define("My.Module/Name", ["optional!js!SBIS3.NavigationController"], function(){});');
      result.hasOwnProperty('isNavigation').should.equal(true);
      result.isNavigation.should.equal(true);

      result = parseJsComponent('define("My.Module/Name", ["Navigation/NavigationController"], function(){});');
      result.hasOwnProperty('isNavigation').should.equal(true);
      result.isNavigation.should.equal(true);

      result = parseJsComponent(
         'define("My.Module/Name", ["optional!Navigation/NavigationController"], function(){});'
      );
      result.hasOwnProperty('isNavigation').should.equal(true);
      result.isNavigation.should.equal(true);
   });
});
