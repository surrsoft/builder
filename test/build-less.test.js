'use strict';

const initTest = require('./init-test');

const
   path = require('path'),
   lib = require('./lib'),
   helpers = require('../lib/helpers'),
   buildLess = require('../lib/build-less');

const workspaceFolder = helpers.prettifyPath(path.join(__dirname, 'fixture/build-less')),
   wsPath = helpers.prettifyPath(path.join(workspaceFolder, 'ws')),
   anyModulePath = path.join(workspaceFolder, 'AnyModule'),
   sbis3ControlsPath = path.join(workspaceFolder, 'SBIS3.CONTROLS'),
   pathsForImport = [workspaceFolder],
   themes = {
      'online': path.join(workspaceFolder, 'SBIS3.CONTROLS/themes/online'),
      'presto': path.join(workspaceFolder, 'SBIS3.CONTROLS/themes/presto'),
      'carry': path.join(workspaceFolder, 'SBIS3.CONTROLS/themes/carry')
   };

describe('build less', () => {
   before(async() => {
      await initTest();
   });

   it('empty less', async() => {
      const filePath = path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less');
      const text = '';
      const result = await buildLess(filePath, text, anyModulePath, sbis3ControlsPath, pathsForImport, themes);
      result[0].compiled.imports.length.should.equal(2);
      result[0].compiled.text.should.equal('');
   });
   it('less with defau`lt theme', async() => {
      const filePath = path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const result = await buildLess(filePath, text, anyModulePath, sbis3ControlsPath, pathsForImport, themes);
      result[0].compiled.imports.length.should.equal(2);
      result[0].compiled.text.should.equal(".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is online';\n}\n");
   });
   it('less from retail', async() => {
      const retailModulePath = path.join(workspaceFolder, 'Retail');
      const filePath = path.join(retailModulePath, 'bla/bla/long/path/test.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const result = await buildLess(filePath, text, retailModulePath, sbis3ControlsPath, pathsForImport, {});
      result[0].compiled.imports.length.should.equal(2);
      result[0].compiled.text.should.equal(".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is carry';\n}\n");
   });
   it('less from retail with presto theme', async() => {
      const retailModulePath = path.join(workspaceFolder, 'Retail');
      const filePath = path.join(retailModulePath, 'themes/presto/test.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const result = await buildLess(filePath, text, retailModulePath, sbis3ControlsPath, pathsForImport, {});
      result[0].compiled.imports.length.should.equal(2);
      result[0].compiled.text.should.equal(".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is presto';\n}\n");
   });
   it('Button less from SBIS3.CONTROLS', async() => {
      const filePath = path.join(workspaceFolder, 'SBIS3.CONTROLS/Button/Button.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const result = await buildLess(filePath, text, sbis3ControlsPath, sbis3ControlsPath, pathsForImport, themes);
      result[0].compiled.imports.length.should.equal(2);
      result[0].compiled.text.should.equal(".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is online';\n}\n");
   });

   // важно отобразить корректно строку в которой ошибка
   it('less with error', async() => {
      const filePath = helpers.prettifyPath(path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less'));
      const text = '@import "notExist";';

      const results = await buildLess(filePath, text, anyModulePath, sbis3ControlsPath, pathsForImport, themes);

      // заменяем слеши, иначе не сравнить на linux и windows одинаково
      const errorMessage = results[0].error.replace(/\\/g, '/');
      return lib
         .trimLessError(errorMessage)
         .should.equal(
            `Ошибка компиляции ${workspaceFolder}/AnyModule/bla/bla/long/path/test.less для темы online:  на строке 1: ` +
            "'notExist' wasn't found."
         );
   });

   it('less with error from SBIS3.CONTROLS', async() => {
      const filePath = helpers.prettifyPath(path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less'));
      const text = '@import "notExist";';

      const results = await buildLess(filePath, text, anyModulePath, sbis3ControlsPath, pathsForImport, themes);

      // заменяем слеши, иначе не сравнить на linux и windows одинаково
      const errorMessage = results[0].error.replace(/\\/g, '/');
      return lib
         .trimLessError(errorMessage)
         .should.equal(
            `Ошибка компиляции ${workspaceFolder}/AnyModule/bla/bla/long/path/test.less для темы online:  на строке 1: ` +
            "'notExist' wasn't found."
         );
   });

   it('less with internal error', async() => {
      const filePath = helpers.prettifyPath(path.join(workspaceFolder, 'AnyModule/test.less'));
      const text = '@import "Error";';
      const lessErrorsByThemes = [];
      Object.keys(themes).forEach((currentTheme) => {
         lessErrorsByThemes.push(`Ошибка компиляции ${workspaceFolder}/AnyModule/Error.less для темы ${currentTheme}:  на строке 1: 'notExist' wasn't found.`);
      });

      const compiledResult = await buildLess(filePath, text, anyModulePath, sbis3ControlsPath, pathsForImport, themes);

      // заменяем слеши, иначе не сравнить на linux и windows одинаково
      const errorMessage = lib.trimLessError(compiledResult[0].error.replace(/\\/g, '/'));
      let result = false;
      lessErrorsByThemes.forEach((currentMessage) => {
         if (currentMessage === errorMessage) {
            result = true;
         }
      });
      return result.should.equals(true);
   });

   it('variables.less from themes', async() => {
      const retailModulePath = path.join(workspaceFolder, 'Retail');
      const filePath = path.join(retailModulePath, 'themes/presto/_variables.less');
      const text = '';
      const result = await buildLess(filePath, text, retailModulePath, sbis3ControlsPath, pathsForImport);
      result[0].hasOwnProperty('ignoreMessage').should.equal(true);
   });

   it('ignore folder _less. №1', async() => {
      const retailModulePath = path.join(workspaceFolder, 'Retail');
      const filePath = path.join(retailModulePath, '_less/themes/presto/normal.less');
      const text = '';
      const result = await buildLess(filePath, text, retailModulePath, sbis3ControlsPath, pathsForImport);
      result[0].hasOwnProperty('ignoreMessage').should.equal(true);
   });

   it('ignore folder _less. №2', async() => {
      const retailModulePath = path.join(workspaceFolder, 'Retail');
      const filePath = path.join(retailModulePath, 'themes\\presto\\_less\\normal.less');
      const text = '';
      const result = await buildLess(filePath, text, retailModulePath, sbis3ControlsPath, pathsForImport);
      result[0].hasOwnProperty('ignoreMessage').should.equal(true);
   });

   it('less from ws', async() => {
      const filePath = path.join(wsPath, 'deprecated/Controls/TabControl/TabControl.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const result = await buildLess(filePath, text, wsPath, sbis3ControlsPath, pathsForImport, themes);
      result[0].compiled.imports.length.should.equal(2);
      result[0].compiled.text.should.equal(
         ".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is online';\n}\n"
      );
   });

   it('less with all theme', async() => {
      const filePath = path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const result = await buildLess(filePath, text, anyModulePath, sbis3ControlsPath, pathsForImport, themes);

      result[0].compiled.imports.length.should.equal(2);
      result[0].compiled.text.should.equal(".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is online';\n}\n");
      result[2].compiled.imports.length.should.equal(2);
      result[2].compiled.text.should.equal(
         ".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is presto';\n}\n"
      );
   });
});
