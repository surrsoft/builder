'use strict';

const initTest = require('./init-test');
const path = require('path');
const workspaceFolder = path.join(__dirname, 'fixture/builder-generate-workflow/packLibraries/Modul');
const { runCompilerAndCheckForErrors } = require('../lib/typescript-compiler');
const { getTranspileOptions } = require('../lib/compile-es-and-ts');

describe('typescript compiler', () => {
   before(async() => {
      await initTest();
   });
   it('should return errors list', async() => {
      const result = await runCompilerAndCheckForErrors(workspaceFolder);
      result.should.have.members([
         '_External_dependence/testExternalLibrary.ts(3,24): error TS2307: Cannot find module \'../../Modul2/_private/Модуль.es\'.',
         'public/publicFunction2.ts(7,15): error TS2569: Type \'Set<any>\' is not an array type or a string type. Use compiler option \'--downlevelIteration\' to allow iterating of iterators.'
      ]);
   });
   it('should return corrent compilerOptions in depends of content format(basic ts module or amd-formatted)', () => {
      let tsContent = "define('Module/myComponent', [], function() { return 'test123'; }";
      let result = getTranspileOptions(null, 'Module/someAnotherName', tsContent);

      // if ts module amd-formatted, compilerOptions shouldn't contain "module" option
      result.compilerOptions.hasOwnProperty('module').should.equal(false);

      result = getTranspileOptions(null, 'Module/myComponent', tsContent);

      // if ts module amd-formatted, compilerOptions shouldn't contain "module" option
      result.compilerOptions.hasOwnProperty('module').should.equal(false);

      tsContent = "import { getter } './getterModule; export default getter;'";
      result = getTranspileOptions(null, 'Module/someAnotherName', tsContent);

      result.compilerOptions.hasOwnProperty('module').should.equal(true);
   });
});
