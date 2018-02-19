'use strict';

const chai = require('chai'),
   path = require('path'),
   fs = require('fs-extra'),
   workerPool = require('workerpool'),
   chaiAsPromised = require('chai-as-promised'),
   helpers = require('../lib/helpers');

chai.use(chaiAsPromised);
chai.should();
const expect = chai.expect;

const workspaceFolder = path.join(__dirname, 'workspace'),
   fixtureFolder = path.join(__dirname, 'fixture/build-worker');

const clearWorkspace = function() {
   return fs.remove(workspaceFolder);
};

const prepareTest = async function() {
   await clearWorkspace();
   await fs.ensureDir(workspaceFolder);
   await fs.copy(fixtureFolder, workspaceFolder);

};

describe('gulp/workers/build-worker.js', function() {
   it('тест с минимально допустимыми входными данными', async function() {
      const pool = workerPool.pool(path.join(__dirname, '../gulp/workers/build-worker.js'));

      try {
         await prepareTest();

         const resultParseJsComponent = await pool.exec('parseJsComponent', ['']);
         Object.keys(resultParseJsComponent).length.should.equal(0);

         const resultParseRoutes = await pool.exec('parseRoutes', ['']);
         Object.keys(resultParseRoutes).length.should.equal(0);

         const resourcePath = path.join(workspaceFolder, '/resources');
         const lessPath = path.join(resourcePath, 'AnyModule/Empty.less');
         const resultsBuildLess = await pool.exec('buildLess', [[lessPath], resourcePath]);
         resultsBuildLess.length.should.equal(1);
         resultsBuildLess[0].hasOwnProperty('error').should.equal(false);
         resultsBuildLess[0].hasOwnProperty('path').should.equal(true);
         resultsBuildLess[0].hasOwnProperty('imports').should.equal(true);
         resultsBuildLess[0].path.should.equal(lessPath);
         resultsBuildLess[0].imports.length.should.equal(2);

      } finally {
         await clearWorkspace();
         await pool.terminate();
      }
   });
   it('тест с обычными входными данными', async function() {
      const pool = workerPool.pool(path.join(__dirname, '../gulp/workers/build-worker.js'));

      try {
         await prepareTest();

         const textForParseJsComponent = 'define("My.Module/Name", function(){});';
         const resultParseJsComponent = await pool.exec('parseJsComponent', [textForParseJsComponent]);
         Object.keys(resultParseJsComponent).length.should.equal(1);
         resultParseJsComponent.componentName.should.equal('My.Module/Name');

         const textForParseRoutes = 'module.exports = function() {\n' +
         '   return {\n' +
         '      \'/test_1.html\': \'js!SBIS3.Test1\'\n' +
         '   };\n' +
         '};\n';
         const resultParseRoutes = await pool.exec('parseRoutes', [textForParseRoutes]);
         Object.getOwnPropertyNames(resultParseRoutes).length.should.equal(1);
         Object.getOwnPropertyNames(resultParseRoutes['/test_1.html']).length.should.equal(1);
         resultParseRoutes['/test_1.html'].controller.should.equal('js!SBIS3.Test1');

         const resourcePath = path.join(workspaceFolder, 'resources');
         const lessPath = path.join(resourcePath, 'AnyModule/Correct.less');
         const outputCssPath = lessPath.replace('.less', '.css');
         const resultsBuildLess = await pool.exec('buildLess', [[lessPath], resourcePath]);
         resultsBuildLess.length.should.equal(1);
         resultsBuildLess[0].hasOwnProperty('error').should.equal(false);
         resultsBuildLess[0].hasOwnProperty('path').should.equal(true);
         resultsBuildLess[0].hasOwnProperty('imports').should.equal(true);
         resultsBuildLess[0].path.should.equal(lessPath);
         resultsBuildLess[0].imports.length.should.equal(2);
         const existCss = await fs.pathExists(outputCssPath);
         existCss.should.equal(true);
         const cssText = await fs.readFile(outputCssPath);
         cssText.toString().should.equal('.test-selector {\n' +
            '  test-mixin: \'mixin there\';\n' +
            '  test-var: \'it is online\';\n' +
            '}\n');

      } finally {
         await clearWorkspace();
         await pool.terminate();
      }
   });
   it('тест корректности возвращаемых ошибок', async function() {
      const pool = workerPool.pool(path.join(__dirname, '../gulp/workers/build-worker.js'));

      try {
         await prepareTest();

         const promiseParseJsComponent = pool.exec('parseJsComponent', ['define(']);
         await expect(promiseParseJsComponent).to.be.rejected.then(function(error) {
            return expect(error).to.have.property('message', 'Ошибка при парсинге: Error: Line 1: Unexpected end of input');
         });

         const promiseParseRoutes = pool.exec('parseRoutes', ['define(']);
         await expect(promiseParseRoutes).to.be.rejected.then(function(error) {
            return expect(error).to.have.property('message', 'Ошибка при парсинге: Error: Line 1: Unexpected end of input');
         });

         const resourcePath = helpers.prettifyPath(path.join(workspaceFolder, 'resources'));
         const lessPath = helpers.prettifyPath(path.join(resourcePath, 'AnyModule/Error.less'));
         const resultsBuildLess = await pool.exec('buildLess', [[lessPath], resourcePath]);
         resultsBuildLess.length.should.equal(1);

         //заменяем слеши, иначе не сравнить на linux и windows одинаково
         const errorMessage = resultsBuildLess[0].error.message.replace(/\\/g, '/');
         errorMessage.should.equal(
            `Ошибка компиляции ${lessPath} на строке 1: ` +
            '\'notExist.less\' wasn\'t found. ' +
            `Tried - ${resourcePath}/AnyModule/notExist.less,notExist.less`);

      } finally {
         await clearWorkspace();
         await pool.terminate();
      }
   });
});
