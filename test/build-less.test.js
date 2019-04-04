/* eslint-disable no-unused-vars */
'use strict';

const initTest = require('./init-test');

const
   path = require('path'),
   lib = require('./lib'),
   helpers = require('../lib/helpers'),
   pMap = require('p-map'),
   {
      processLessFile,
      resolveThemeName,
      buildLess,
      getThemeImport
   } = require('../lib/build-less');

const workspaceFolder = helpers.prettifyPath(path.join(__dirname, 'fixture/build-less')),
   pathsForImport = [workspaceFolder],
   themes = {
      'online': path.join(workspaceFolder, 'SBIS3.CONTROLS/themes/online'),
      'presto': path.join(workspaceFolder, 'SBIS3.CONTROLS/themes/presto'),
      'carry': path.join(workspaceFolder, 'SBIS3.CONTROLS/themes/carry')
   };

const defaultModuleThemeObject = {
   name: 'online',
   path: themes.online,
   isDefault: true
};

describe('build less', () => {
   before(async() => {
      await initTest();
   });

   const gulpModulesInfo = {
      pathsForImport,
      gulpModulesPaths: {
         'SBIS3.CONTROLS': path.join(workspaceFolder, 'SBIS3.CONTROLS'),
         'Controls-theme': path.join(workspaceFolder, 'Controls-theme')
      }
   };
   it('empty less', async() => {
      const filePath = helpers.prettifyPath(path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less'));
      const text = '';
      const result = await processLessFile(text, filePath, defaultModuleThemeObject, gulpModulesInfo, {});
      result.imports.length.should.equal(2);
      result.text.should.equal('');
   });
   it('less with defau`lt theme', async() => {
      const filePath = path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const result = await processLessFile(text, filePath, defaultModuleThemeObject, gulpModulesInfo, {});
      result.imports.length.should.equal(2);
      result.text.should.equal(".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is online';\n}\n");
   });
   it('less from retail', async() => {
      const retailModulePath = helpers.prettifyPath(path.join(workspaceFolder, 'Retail'));
      const filePath = helpers.prettifyPath(path.join(retailModulePath, 'bla/bla/long/path/test.less'));
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const themeName = resolveThemeName(filePath, retailModulePath);
      const result = await processLessFile(text, filePath, {
         name: themeName,
         path: themes[themeName]
      }, gulpModulesInfo, {});
      result.imports.length.should.equal(2);
      result.text.should.equal(".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is carry';\n}\n");
   });
   it('less from retail with presto theme', async() => {
      const retailModulePath = helpers.prettifyPath(path.join(workspaceFolder, 'Retail'));
      const filePath = helpers.prettifyPath(path.join(retailModulePath, 'themes/presto/test.less'));
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const themeName = resolveThemeName(filePath, retailModulePath);
      const result = await processLessFile(text, filePath, {
         name: 'presto',
         path: themes[themeName]
      }, gulpModulesInfo, {});
      result.imports.length.should.equal(2);
      result.text.should.equal(".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is presto';\n}\n");
   });
   it('Button less from SBIS3.CONTROLS', async() => {
      const filePath = helpers.prettifyPath(path.join(workspaceFolder, 'SBIS3.CONTROLS/Button/Button.less'));
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const themeName = resolveThemeName(filePath, filePath);
      const result = await processLessFile(text, filePath, {
         name: themeName,
         path: themes[themeName]
      }, gulpModulesInfo, {});
      result.imports.length.should.equal(2);
      result.text.should.equal(".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is online';\n}\n");
   });

   // важно отобразить корректно строку в которой ошибка
   it('less with error', async() => {
      const filePath = helpers.prettifyPath(path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less'));
      const text = '@import "notExist";';
      const themeName = resolveThemeName(filePath, filePath);
      let errorMessage;
      try {
         const result = await processLessFile(text, filePath, {
            name: themeName,
            path: themes[themeName]
         }, gulpModulesInfo, {});
      } catch (error) {
         // заменяем слеши, иначе не сравнить на linux и windows одинаково
         errorMessage = error.message.replace(/\\/g, '/');
      }

      return lib
         .trimLessError(errorMessage)
         .should.equal(
            `Error compiling less: "${workspaceFolder}/AnyModule/bla/bla/long/path/test.less" for theme online(new theme type):` +
            "  in line 1: 'notExist' wasn't found."
         );
   });

   it('less with error from SBIS3.CONTROLS', async() => {
      const filePath = helpers.prettifyPath(path.join(workspaceFolder, 'AnyModule/bla/bla/long/path/test.less'));
      const text = '@import "notExist";';
      const themeName = resolveThemeName(filePath, filePath);
      let errorMessage;
      try {
         const result = await processLessFile(text, filePath, {
            name: themeName,
            path: themes[themeName]
         }, gulpModulesInfo, {});
      } catch (error) {
         // заменяем слеши, иначе не сравнить на linux и windows одинаково
         errorMessage = error.message.replace(/\\/g, '/');
      }

      return lib
         .trimLessError(errorMessage)
         .should.equal(
            `Error compiling less: "${workspaceFolder}/AnyModule/bla/bla/long/path/test.less" for theme online(new theme type):` +
            "  in line 1: 'notExist' wasn't found."
         );
   });

   it('less with internal error', async() => {
      const filePath = helpers.prettifyPath(path.join(workspaceFolder, 'AnyModule/test.less'));
      const text = '@import "Error";';
      const lessErrorsByThemes = [];
      const lessResults = [];
      await pMap(
         Object.keys(themes),
         async(currentTheme) => {
            lessErrorsByThemes.push(`Error compiling less: "${workspaceFolder}/AnyModule/Error.less" for theme ${currentTheme}` +
               "(new theme type):  in line 1: 'notExist' wasn't found.");
            try {
               const themeName = resolveThemeName(filePath, filePath);
               const result = await processLessFile(text, filePath, {
                  name: themeName,
                  path: themes[themeName],
               }, gulpModulesInfo, {});
            } catch (error) {
               // заменяем слеши, иначе не сравнить на linux и windows одинаково
               lessResults.push(error.message.replace(/\\/g, '/'));
            }
         },
         {
            concurrency: 3
         }
      );

      // заменяем слеши, иначе не сравнить на linux и windows одинаково
      const errorMessage = lib.trimLessError(lessResults[0]);
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
      const lessInfo = {
         modulePath: retailModulePath,
         filePath,
         text
      };
      const result = await buildLess({}, lessInfo, gulpModulesInfo);
      result[0].hasOwnProperty('ignoreMessage').should.equal(true);
   });

   it('ignore folder _less. №1', async() => {
      const retailModulePath = path.join(workspaceFolder, 'Retail');
      const filePath = path.join(retailModulePath, '_less/themes/presto/normal.less');
      const text = '';
      const lessInfo = {
         modulePath: retailModulePath,
         filePath,
         text
      };
      const result = await buildLess({}, lessInfo, gulpModulesInfo);
      result[0].hasOwnProperty('ignoreMessage').should.equal(true);
   });

   it('ignore folder _less. №2', async() => {
      const retailModulePath = path.join(workspaceFolder, 'Retail');
      const filePath = path.join(retailModulePath, 'themes\\presto\\_less\\normal.less');
      const text = '';
      const lessInfo = {
         modulePath: retailModulePath,
         filePath,
         text
      };
      const result = await buildLess({}, lessInfo, gulpModulesInfo);
      result[0].hasOwnProperty('ignoreMessage').should.equal(true);
   });

   it('less from WS.Deprecated', async() => {
      const filePath = path.join(workspaceFolder, 'WS.Deprecated/Controls/TabControl/TabControl.less');
      const text = '.test-selector {\ntest-mixin: @test-mixin;test-var: @test-var;}';
      const themeName = resolveThemeName(filePath, filePath);
      const result = await processLessFile(text, filePath, {
         name: themeName,
         path: themes[themeName]
      }, gulpModulesInfo, {});
      result.imports.length.should.equal(2);
      result.text.should.equal(
         ".test-selector {\n  test-mixin: 'mixin there';\n  test-var: 'it is online';\n}\n"
      );
   });

   it('get correct variables import', () => {
      let result = getThemeImport({
         isDefault: true,
         name: 'online',
         path: 'SBIS3.CONTROLS/themes/online/_variables'
      }, true);
      result.should.equal('@import \'SBIS3.CONTROLS/themes/online/_variables/_variables\';');
      result = getThemeImport({
         isDefault: true,
         name: 'online',
         path: 'SBIS3.CONTROLS/themes/online/_variables',
         variablesFromLessConfig: 'Controls-theme'
      }, true);
      result.should.equal('@import \'Controls-theme/themes/default/default\';');
      result = getThemeImport({
         isDefault: true,
         name: 'default',
         path: 'Controls-theme/themes/default'
      }, true);
      result.should.equal('@import \'Controls-theme/themes/default/default\';');
      result = getThemeImport({
         isDefault: true,
         name: 'carry'
      }, true);
      result.should.equal('@import \'Controls-theme/themes/default/_variables\';');
      result = getThemeImport({
         isDefault: true,
         name: 'default'
      }, false);
      result.should.equal('');
   });
});
