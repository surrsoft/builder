'use strict';

//логгер - глобальный
require('../lib/logger').setGulpLogger(require('gulplog'));

const chai = require('chai'),
   chaiAsPromised = require('chai-as-promised'),
   path = require('path'),
fs = require('fs-extra'),
   runJsonGenerator = require('../lib/i18n/run-json-generator');

chai.use(chaiAsPromised);
chai.should();

const testDirname = path.join(__dirname, 'fixture/run-json-generator');
const outputPath = path.join(testDirname, 'output');

function clear(){
   fs.removeSync(outputPath);
}
function writeModulesListToFile() {
   const modulesJsonPath = path.join(outputPath, 'modules.json');
   const modules = [
      path.join(testDirname, 'TestModuleWithModuleJs'),
      path.join(testDirname, 'TestModuleWithoutModuleJs')
   ];
   fs.writeFileSync(modulesJsonPath, JSON.stringify(modules));
   return modulesJsonPath;
}

describe('build less', function() {
   it('empty less', async() => {
      clear();
      const modulesJsonPath = writeModulesListToFile();
      const result = await runJsonGenerator(modulesJsonPath, outputPath, testDirname);
      result.fileName.should.equal('test');
      result.imports.length.should.equal(2);
      result.text.should.equal('');
   });

});

