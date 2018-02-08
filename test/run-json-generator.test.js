'use strict';

//логгер - глобальный
require('../lib/logger').setGulpLogger(require('gulplog'));

const chai = require('chai'),
   chaiAsPromised = require('chai-as-promised'),
   path = require('path'),
   fs = require('fs-extra'),
   mkdirp = require('mkdirp'),
   runJsonGenerator = require('../lib/i18n/run-json-generator');

chai.use(chaiAsPromised);
chai.should();

const testDirname = path.join(__dirname, 'fixture/run-json-generator');
const outputPath = path.join(testDirname, 'output');

function clear(){
   fs.removeSync(outputPath);
}
function writeModulesListToFile(modules) {
   mkdirp(outputPath);
   const modulesJsonPath = path.join(outputPath, 'modules.json');
   fs.writeFileSync(modulesJsonPath, JSON.stringify(modules));
   return modulesJsonPath;
}

describe('run json-generator', function() {
   this.timeout(10000);
   it('empty modules', async() => {
      clear();
      const modulesJsonPath = writeModulesListToFile([]);
      const result = await runJsonGenerator(modulesJsonPath, outputPath, testDirname);
      result.fileName.should.equal('test');
      result.imports.length.should.equal(2);
      result.text.should.equal('');
      clear();
   });
   it('empty modules', async() => {
      clear();
      const modulesJsonPath = writeModulesListToFile([
         path.join(testDirname, 'TestModuleWithModuleJs'),
         path.join(testDirname, 'TestModuleWithoutModuleJs')
      ]);
      const result = await runJsonGenerator(modulesJsonPath, outputPath, testDirname);
      result.fileName.should.equal('test');
      result.imports.length.should.equal(2);
      result.text.should.equal('');
      clear();
   });
});

