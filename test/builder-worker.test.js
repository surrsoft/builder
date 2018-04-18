/* eslint-disable promise/prefer-await-to-then*/

'use strict';

require('./init-test');

const chai = require('chai'),
   path = require('path'),
   fs = require('fs-extra'),
   helpers = require('../lib/helpers'),
   workerPool = require('workerpool');

const expect = chai.expect;

const workspaceFolder = path.join(__dirname, 'workspace'),
   fixtureFolder = path.join(__dirname, 'fixture/build-worker'),
   workerPath = path.join(__dirname, '../gulp/builder/worker.js'),
   modulePath = helpers.prettifyPath(path.join(workspaceFolder, 'AnyModule')),
   sbis3ControlsPath = path.join(workspaceFolder, 'SBIS3.CONTROLS'),
   builderFolder = helpers.prettifyPath(path.normalize(path.join(__dirname, '/../')));

const clearWorkspace = function() {
   return fs.remove(workspaceFolder);
};

const prepareTest = async function() {
   await clearWorkspace();
   await fs.ensureDir(workspaceFolder);
   await fs.copy(fixtureFolder, workspaceFolder);
};

describe('gulp/builder/worker.js', function() {
   it('тест с минимально допустимыми входными данными', async function() {
      const pool = workerPool.pool(workerPath);

      try {
         await prepareTest();

         const resultParseJsComponent = await pool.exec('parseJsComponent', ['']);
         Object.keys(resultParseJsComponent).length.should.equal(0);

         const resultParseRoutes = await pool.exec('parseRoutes', ['']);
         Object.keys(resultParseRoutes).length.should.equal(0);

         const filePath = path.join(modulePath, 'Empty.less');
         const text = (await fs.readFile(filePath)).toString();
         const resultsBuildLess = await pool.exec('buildLess', [filePath, text, modulePath, sbis3ControlsPath]);
         resultsBuildLess.hasOwnProperty('imports').should.equal(true);
         resultsBuildLess.hasOwnProperty('text').should.equal(true);
         resultsBuildLess.imports.length.should.equal(2);
         resultsBuildLess.text.should.equal('');
      } finally {
         await clearWorkspace();
         await pool.terminate();
      }
   });
   it('тест с обычными входными данными', async function() {
      const pool = workerPool.pool(workerPath);

      try {
         await prepareTest();

         const textForParseJsComponent = 'define("My.Module/Name", function(){});';
         const resultParseJsComponent = await pool.exec('parseJsComponent', [textForParseJsComponent]);
         Object.keys(resultParseJsComponent).length.should.equal(1);
         resultParseJsComponent.componentName.should.equal('My.Module/Name');

         const textForParseRoutes =
            'module.exports = function() {\n' +
            '   return {\n' +
            "      '/test_1.html': 'js!SBIS3.Test1'\n" +
            '   };\n' +
            '};\n';
         const resultParseRoutes = await pool.exec('parseRoutes', [textForParseRoutes]);
         Object.getOwnPropertyNames(resultParseRoutes).length.should.equal(1);
         Object.getOwnPropertyNames(resultParseRoutes['/test_1.html']).length.should.equal(1);
         resultParseRoutes['/test_1.html'].controller.should.equal('js!SBIS3.Test1');

         const filePath = path.join(modulePath, 'Correct.less');
         const text = (await fs.readFile(filePath)).toString();
         const resultsBuildLess = await pool.exec('buildLess', [filePath, text, modulePath, sbis3ControlsPath]);
         resultsBuildLess.hasOwnProperty('imports').should.equal(true);
         resultsBuildLess.hasOwnProperty('text').should.equal(true);
         resultsBuildLess.imports.length.should.equal(2);
         resultsBuildLess.text.should.equal(
            '.test-selector {\n' + "  test-mixin: 'mixin there';\n" + "  test-var: 'it is online';\n" + '}\n'
         );
      } finally {
         await clearWorkspace();
         await pool.terminate();
      }
   });
   it('тест корректности возвращаемых ошибок', async function() {
      const pool = workerPool.pool(workerPath);

      try {
         await prepareTest();

         const promiseParseJsComponent = pool.exec('parseJsComponent', ['define(']);
         await expect(promiseParseJsComponent).to.be.rejected.then(function(error) {
            return expect(error).to.have.property(
               'message',
               'Ошибка при парсинге: Error: Line 1: Unexpected end of input'
            );
         });

         const promiseParseRoutes = pool.exec('parseRoutes', ['define(']);
         await expect(promiseParseRoutes).to.be.rejected.then(function(error) {
            return expect(error).to.have.property(
               'message',
               'Ошибка при парсинге: Error: Line 1: Unexpected end of input'
            );
         });

         const filePath = helpers.prettifyPath(path.join(modulePath, 'Error.less'));
         const text = (await fs.readFile(filePath)).toString();
         const promise = pool.exec('buildLess', [filePath, text, modulePath, sbis3ControlsPath]);

         return expect(promise).to.be.rejected.then(function(error) {
            //заменяем слеши, иначе не сравнить на linux и windows одинаково
            const errorMessage = error.message.replace(/\\/g, '/');
            return errorMessage.should.equal(
               `Ошибка компиляции ${filePath} на строке 1: ` +
                  "'notExist' wasn't found. " +
                  'Tried - ' +
                  `${modulePath}/notExist.less,` +
                  `${helpers.prettifyPath(path.join(builderFolder, '/node_modules/notExist.less'))},` +
                  'notExist.less'
            );
         });
      } finally {
         await clearWorkspace();
         await pool.terminate();
      }
   });
});
