'use strict';

const chai = require('chai'),
   chaiAsPromised = require('chai-as-promised'),
   path = require('path'),
   helpers = require('../lib/helpers');

//логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger(require('gulplog'));

const generateStaticHtmlForJs = require('../lib/generate-static-html-for-js');

chai.use(chaiAsPromised);
const should = chai.should();

const config = {
   root: helpers.prettifyPath(path.join(__dirname, 'fixture/generate-static-html-for-js')),
   application: '/',
   servicesPath: '/service/',
   userParams: true,
   globalParams: false,
   urlServicePath: '/',
   wsPath: 'ws/'
};

const modules = new Map([
   ['Модуль', helpers.prettifyPath(path.join(__dirname, 'fixture/generate-static-html-for-js/Modules/Модуль'))],
   ['Тема Скрепка', helpers.prettifyPath(path.join(__dirname, 'fixture/generate-static-html-for-js/Modules/Тема Скрепка'))],
   ['Ошибки', helpers.prettifyPath(path.join(__dirname, 'fixture/generate-static-html-for-js/Modules/Ошибки'))]
]);

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
         const result = await generateStaticHtmlForJs('virtualFile', componentInfo, contents, config, modules, true);
         contents.htmlNames.MyModule.should.equal('testOutFileName.html');
         result.outFileName.should.equal('testOutFileName.html');
         result.text.should.equal('\n\n\n');
      });
      it('replacePath', async() => {
         const test = async(replacePath, expected) => {
            const componentInfo = {
               componentName: 'MyModule',
               webPage: {
                  htmlTemplate: 'Тема Скрепка/flags.html',
                  outFileName: 'testOutFileName',
                  title: 'testTitle'
               }
            };
            const contents = {};
            const result = await generateStaticHtmlForJs('virtualFile', componentInfo, contents, config, modules, replacePath);
            contents.htmlNames.MyModule.should.equal('testOutFileName.html');
            result.outFileName.should.equal('testOutFileName.html');
            result.text.should.equal(expected);
         };

         await test(true, 'true\n' +
            'false\n' +
            'false\n');
         await test(false, '%{CONFIG.USER_PARAMS}\n' +
            '%{CONFIG.GLOBAL_PARAMS}\n' +
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
         const result = await generateStaticHtmlForJs('virtualFile', componentInfo, contents, config, modules, true);
         contents.htmlNames.MyModule.should.equal('testOutFileName.html');
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
         const result = await generateStaticHtmlForJs('virtualFile', componentInfo, contents, config, modules, true);
         contents.htmlNames.MyModule.should.equal('testOutFileName.html');
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
         const result = await generateStaticHtmlForJs('virtualFile', componentInfo, contents, config, modules, true);
         contents.htmlNames.MyModule.should.equal('testOutFileName.html');
         result.outFileName.should.equal('testOutFileName.html');
         result.text.should.equal('TITLE:testTitle\n' +
            'START_DIALOG:MyModule\n');
      });
      it('component without web page', async() => {
         const componentInfo = {
            componentName: 'MyModule'
         };
         const contents = {};
         const result = await generateStaticHtmlForJs('virtualFile', componentInfo, contents, config, modules, true);
         should.not.exist(result);
      });
      it('component without name', () => {
         const componentInfo = {
            webPage: {
               htmlTemplate: 'Тема Скрепка/title.html',
               outFileName: 'testOutFileName',
               title: 'testTitle'
            }
         };
         const contents = {};
         return generateStaticHtmlForJs('virtualFile', componentInfo, contents, config, modules, true).should.be.rejectedWith('Не указано имя компонента');
      });
      it('module not exist', () => {
         const componentInfo = {
            webPage: {
               htmlTemplate: 'Сказочный модуль/title.html',
               outFileName: 'testOutFileName',
               title: 'testTitle'
            }
         };
         const contents = {};
         return generateStaticHtmlForJs('virtualFile', componentInfo, contents, config, modules, true)
            .should.be.rejectedWith('Не указано имя компонента');
      });
      it('recursive includes error', () => {
         const componentInfo = {
            componentName: 'MyModule',
            webPage: {
               htmlTemplate: 'Ошибки/includes.html',
               outFileName: 'testOutFileName',
               title: 'testTitle'
            }
         };
         const contents = {};
         const root = helpers.prettifyPath(path.join(__dirname, 'fixture/generate-static-html-for-js'));
         return generateStaticHtmlForJs('virtualFile', componentInfo, contents, config, modules, true)
            .should.be.rejectedWith(
               `Ошибка при обработке файла ${root}/Modules/Ошибки/includes.html: ` +
               `Ошибка при обработке файла ${root}/Modules/Ошибки/include1.html: ` +
               `Ошибка при обработке файла ${root}/Modules/Ошибки/include2.html: ` +
               `ENOENT: no such file or directory, open '${root}/Modules/Ошибки/include3.html`);
      });
   });
});
