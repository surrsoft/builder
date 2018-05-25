'use strict';

require('./init-test');

const chai = require('chai'),
   processingRoutes = require('../lib/processing-routes');

const expect = chai.expect;

describe('processing routes.js', () => {
   describe('parse routes', () => {
      it('empty file', () => {
         const result = processingRoutes.parseRoutes('');
         Object.getOwnPropertyNames(result).length.should.equal(0);
      });
      it('file with error', () => {
         expect(() => {
            processingRoutes.parseRoutes('define(');
         }).to.throw('Line 1: Unexpected end of input');
      });
      it('route to component', () => {
         const result = processingRoutes.parseRoutes('module.exports = function() {\n' +
            '   return {\n' +
            '      \'/test_1.html\': \'js!SBIS3.Test1\',\n' +
            '      \'/test_2.html\': \'js!SBIS3.Test2\'\n' +
            '   };\n' +
            '};\n');
         Object.getOwnPropertyNames(result).length.should.equal(2);
         Object.getOwnPropertyNames(result['/test_1.html']).length.should.equal(1);
         result['/test_1.html'].controller.should.equal('js!SBIS3.Test1');
         Object.getOwnPropertyNames(result['/test_2.html']).length.should.equal(1);
         result['/test_2.html'].controller.should.equal('js!SBIS3.Test2');
      });
      it('route to function', () => {
         const result = processingRoutes.parseRoutes('module.exports = function (Component, Service) {\n' +
            '   return {\n' +
            '      \'/test_1/\': function (req, res) {\n' +
            '      },\n' +
            '      \'/test_2/\': function (req, res) {\n' +
            '      }\n' +
            '   }\n' +
            '};');
         Object.getOwnPropertyNames(result).length.should.equal(2);
         Object.getOwnPropertyNames(result['/test_1/']).length.should.equal(1);
         expect(result['/test_1/'].controller).to.be.null; // eslint-disable-line no-unused-expressions
         Object.getOwnPropertyNames(result['/test_2/']).length.should.equal(1);
         expect(result['/test_2/'].controller).to.be.null; // eslint-disable-line no-unused-expressions
      });
      it('no return routes', () => {
         // примеры не корретного роутинга:
         // - ключ роутинга не начинаться с слеша
         // - значение роутинго - объект
         const text = 'module.exports = function (Component, Service) {\n' +
            '   return {\n' +
            '      "test_1": "TEST",\n' +
            '      "/test_2/": {}\n' +
            '   }\n' +
            '};';

         expect(() => {
            processingRoutes.parseRoutes(text);
         }).to.throw('Не удалось найти ни одного корректного роутинга в объекте');
      });
      it('return string', () => {
         const text = 'module.exports = "TEST";';

         expect(() => {
            processingRoutes.parseRoutes(text);
         }).to.throw('Экспортируется не объект и не функция');
      });
   });

   describe('prepare to save', () => {
      it('routes info is empty', () => {
         const routesInfo = {};
         const jsModules = [];
         processingRoutes.prepareToSave(routesInfo, jsModules);
         Object.getOwnPropertyNames(routesInfo).length.should.equal(0);
      });
      it('controller exist', () => {
         const routesInfo = {
            'resources/Test.routes.js': {
               '/test.html': {
                  'controller': 'js!SBIS3.Test'
               }
            }
         };
         const jsModules = ['SBIS3.Test'];
         processingRoutes.prepareToSave(routesInfo, jsModules);
         routesInfo['resources/Test.routes.js']['/test.html'].isMasterPage.should.equal(true);
      });
      it('controller not exist', () => {
         const routesInfo = {
            'resources/Test.routes.js': {
               '/test.html': {
                  'controller': 'js!SBIS3.Test'
               }
            }
         };
         const jsModules = [];
         processingRoutes.prepareToSave(routesInfo, jsModules);
         routesInfo['resources/Test.routes.js']['/test.html'].isMasterPage.should.equal(false);
      });
   });
});
