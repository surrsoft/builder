'use strict';

const chai = require('chai'),
   chaiAsPromised = require('chai-as-promised'),
   path = require('path');

//логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger(require('gulplog'));

const generateStaticHtmlForJs = require('../lib/generate-static-html-for-js');

chai.use(chaiAsPromised);
const should = chai.should();

const config = {
   root: path.join(__dirname, 'fixture/generate-static-html-for-js'),
   application: '/',
   servicesPath: '/service/',
   userParams: true,
   globalParams: false
};

const resourcesPath = path.join(__dirname, 'fixture/generate-static-html-for-js/resources');

describe('generate static html for js', function() {
   describe('module with web page', function() {
      it('empty', async() => {
         const componentInfo = {
            componentName: 'MyModule',
            webPage: {
               htmlTemplate: 'Тема Скрепка/empty.html',
               outFileName: 'testOutFileName',
               title: 'testTitle'
            }
         };
         const contents = {};
         const result = await generateStaticHtmlForJs(componentInfo, contents, config, resourcesPath, false);
         contents.htmlNames['MyModule'].should.equal('testOutFileName.html');
         result.outFileName.should.equal('testOutFileName.html');
         result.text.should.equal('\n\n\n');
      });
      it('flags', async() => {
         const componentInfo = {
            componentName: 'MyModule',
            webPage: {
               htmlTemplate: 'Тема Скрепка/flags.html',
               outFileName: 'testOutFileName',
               title: 'testTitle'
            }
         };
         const contents = {};
         const result = await generateStaticHtmlForJs(componentInfo, contents, config, resourcesPath, false);
         contents.htmlNames['MyModule'].should.equal('testOutFileName.html');
         result.outFileName.should.equal('testOutFileName.html');
         result.text.should.equal('true\n' +
            'false\n' +
            'false\n');
      });
      it('includes', async() => {
         const componentInfo = {
            componentName: 'MyModule',
            webPage: {
               htmlTemplate: 'Тема Скрепка/includes.html',
               outFileName: 'testOutFileName',
               title: 'testTitle'
            }
         };
         const contents = {};
         const result = await generateStaticHtmlForJs(componentInfo, contents, config, resourcesPath, false);
         contents.htmlNames['MyModule'].should.equal('testOutFileName.html');
         result.outFileName.should.equal('testOutFileName.html');
         result.text.should.equal('<INCLUDE1/>\n\n' +
            '<INCLUDE2/>\n' +
            '<INCLUDE1/>\n\n\n');
      });
      it('paths', async() => {
         const componentInfo = {
            componentName: 'MyModule',
            webPage: {
               htmlTemplate: 'Тема Скрепка/paths.html',
               outFileName: 'testOutFileName',
               title: 'testTitle'
            }
         };
         const contents = {};
         const result = await generateStaticHtmlForJs(componentInfo, contents, config, resourcesPath, false);
         contents.htmlNames['MyModule'].should.equal('testOutFileName.html');
         result.outFileName.should.equal('testOutFileName.html');
         result.text.should.equal('RESOURCE_ROOT:/resources/\n' +
            'WI.SBIS_ROOT:/ws/\n' +
            'APPLICATION_ROOT:/\n' +
            'SERVICES_PATH:/service/\n');
      });
      it('title', async() => {
         const componentInfo = {
            componentName: 'MyModule',
            webPage: {
               htmlTemplate: 'Тема Скрепка/title.html',
               outFileName: 'testOutFileName',
               title: 'testTitle'
            }
         };
         const contents = {};
         const result = await generateStaticHtmlForJs(componentInfo, contents, config, resourcesPath, false);
         contents.htmlNames['MyModule'].should.equal('testOutFileName.html');
         result.outFileName.should.equal('testOutFileName.html');
         result.text.should.equal('TITLE:testTitle\n' +
            'START_DIALOG:MyModule\n');
      });
      it('module without web page', async() => {
         const componentInfo = {
            componentName: 'MyModule'
         };
         const contents = {};
         const result = await generateStaticHtmlForJs(componentInfo, contents, config, resourcesPath, false);
         should.not.exist(result);
      });
      it('module without name', async() => {
         const componentInfo = {
            webPage: {
               htmlTemplate: 'Тема Скрепка/title.html',
               outFileName: 'testOutFileName',
               title: 'testTitle'
            }
         };
         const contents = {};
         return generateStaticHtmlForJs(componentInfo, contents, config, false).should.be.rejectedWith('Не указано имя компонента');
      });

   });
});
