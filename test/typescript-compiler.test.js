'use strict';

const initTest = require('./init-test');
const path = require('path');
const workspaceFolder = path.join(__dirname, 'fixture/builder-generate-workflow/packLibraries/Modul');
const { runCompilerAndCheckForErrors } = require('../lib/typescript-compiler');


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
});
