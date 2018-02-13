'use strict';

const chai = require('chai'),
   path = require('path'),
   workerPool = require('workerpool'),
   chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.should();
const expect = chai.expect;

describe('build worker', function() {
   it('тест для пустых файлов', async function() {
      const pool = workerPool.pool(path.join(__dirname, '../gulp/workers/build-worker.js'));

      try {
         const resultParseJsComponent = await pool.exec('parseJsComponent', ['']);
         Object.keys(resultParseJsComponent).length.should.equal(0);

         const resultParseRoutes = await pool.exec('parseRoutes', ['']);
         Object.keys(resultParseRoutes).length.should.equal(0);

         const resourcePath = path.join(__dirname, 'fixture/build-worker/resources');
         const lessPath = path.join(resourcePath, 'AnyModule/Empty.less');
         const resultsBuildLess = await pool.exec('buildLess', [[lessPath], resourcePath]);
         resultsBuildLess.length.should.equal(1);
         resultsBuildLess[0].hasOwnProperty('error').should.equal(false);
         resultsBuildLess[0].hasOwnProperty('path').should.equal(true);
         resultsBuildLess[0].hasOwnProperty('imports').should.equal(true);
         resultsBuildLess[0].path.should.equal(lessPath);
         resultsBuildLess[0].imports.length.should.equal(2);

      } finally {
         pool.terminate();
      }
   });
   it('проверяем, что ошибки возвращаются корректно', async function() {
      const pool = workerPool.pool(path.join(__dirname, '../gulp/workers/build-worker.js'));

      try {
         const promiseParseJsComponent = pool.exec('parseJsComponent', ['define(']);
         await expect(promiseParseJsComponent).to.be.rejected.then(function(error) {
            expect(error).to.have.property('message', 'Ошибка при парсинге: Error: Line 1: Unexpected end of input');
         });

         const promiseParseRoutes = pool.exec('parseRoutes', ['define(']);
         await expect(promiseParseRoutes).to.be.rejected.then(function(error) {
            expect(error).to.have.property('message', 'Ошибка при парсинге: Error: Line 1: Unexpected end of input');
         });

         const resourcePath = path.join(__dirname, 'fixture/build-worker/resources');
         const lessPath = path.join(resourcePath, 'AnyModule/Error.less');
         const resultsBuildLess = await pool.exec('buildLess', [[lessPath], resourcePath]);
         resultsBuildLess.length.should.equal(1);
         resultsBuildLess[0].error.message.should.equal(
            `Ошибка компиляции ${lessPath} на строке 1: ` +
            '\'notExist.less\' wasn\'t found. ' +
            `Tried - ${resourcePath}/AnyModule/notExist.less,notExist.less`);

      } finally {
         pool.terminate();
      }
   });
});
