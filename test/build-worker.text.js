'use strict';

const chai = require('chai'),
   path = require('path'),
   workerPool = require('workerpool'),
   chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.should();
const expect = chai.expect;

describe('build worker', function() {
   it('test for normal exit', async function() {
      const pool = workerPool.pool(path.join(__dirname, '../gulp/workers/build-worker.js'));

      const resultparseJsComponent = await pool.exec('parseJsComponent', ['']);

      return pool.terminate();
   });
   it('test for error exit', async function() {
      const promises = [];
      const pool = workerPool.pool(path.join(__dirname, '../gulp/workers/build-worker.js'));

      try {
         const promiseParseJsComponent = pool.exec('parseJsComponent', ['define(']);
         await expect(promiseParseJsComponent).to.be.rejected.then(function(error) {
            expect(error).to.have.property('message', 'Ошибка при парсинге: Error: Line 1: Unexpected end of input');
         });
         promises.push(promiseParseJsComponent);

         const promiseParseRoutes = pool.exec('parseRoutes', ['define(']);
         await expect(promiseParseRoutes).to.be.rejected.then(function(error) {
            expect(error).to.have.property('message', 'Ошибка при парсинге: Error: Line 1: Unexpected end of input');
         });

         const resourcePath = path.join(__dirname, 'fixture/build-less/resources');
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
