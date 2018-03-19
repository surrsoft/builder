'use strict';
const less = require('less'),
   path = require('path'),
   helpers = require('../lib/helpers');

const defaultTheme = 'online';
const themes = [
   'carry',
   'carry_medium',
   'carrynew',
   'carrynew_medium',
   'cloud',
   'genie',
   'online',
   'presto',
   'presto_medium',
   'prestonew',
   'prestonew_medium'
];
const themesForModules = new Map([
   ['CloudControl', 'cloud'], //новое имя
   ['Upravlenie_oblakom', 'cloud'], //старое имя
   ['Presto', 'presto'],
   ['Retail', 'carry']
]);

//не все файлы в теме нужно компилировать
const filesForIgnoreInThemes = new Set([
   'variables.less',
   'mixin.less',
   'mixins.less',
   'theme.less',
   'header.less',
   'typography.less',
   'general.less',
   'flex.less',
   'defaults.less',
   'theme-fixme.less',
   'sizes.less',
   'colors.less'
]);

function getModuleName(filePath, resourcePath) {
   return helpers.getFirstDirInRelativePath(filePath.replace(resourcePath, ''));
}

/**
 @workaround ресолвим текущую тему по названию модуля или папке в темах
 */
function resolveThemeName(filePath, resourcePath) {
   const relativePath = filePath.replace(resourcePath, '');
   for (const themeName of themes) {
      if (relativePath.includes(`/themes/${themeName}/`)) {
         return themeName;
      }
   }
   const moduleName = getModuleName(filePath, resourcePath);
   if (themesForModules.has(moduleName)) {
      return themesForModules.get(moduleName);
   }
   return defaultTheme;
}

function processLessFile(data, filePath, theme, resourcesPath) {
   return new Promise(async function(resolve, reject) {
      try {
         if (filePath.includes('/themes/') && filesForIgnoreInThemes.has(path.basename(filePath))) {
            resolve({
               ignoreMessage: `Файл '${filePath}' не был скомпилирован, т.к. внесён в список для игнорирования.`
            });
            return;
         }

         const themesPath = path.join(resourcesPath, 'SBIS3.CONTROLS/themes'),
            variablesPath = path.join(themesPath, theme, 'variables'),
            mixinsPath = path.join(themesPath, 'mixins');

         const imports = [`@import '${variablesPath}';`,
            `@import '${mixinsPath}';`,
            `@themeName: ${theme};`];

         const newData = [].concat(imports, [data]).join('\n');
         try {
            const output = await less.render(newData, {
               filename: filePath,
               cleancss: false,
               relativeUrls: true,
               strictImports: true
            });
            resolve({
               text: output.css,
               imports: output.imports,
               theme: theme
            });
         } catch (error) {
            //error.line может не существовать.
            let errorLineStr = '';
            if (error.hasOwnProperty('line') && typeof error.line === 'number') {
               let errorLine = error.line;
               if (helpers.prettifyPath(error.filename) === helpers.prettifyPath(filePath) && errorLine >= imports.length) {
                  //сколько строк добавили в файл, столько и вычтем для вывода ошибки
                  //в errorLine не должно быть отрицательных значений.
                  errorLine -= imports.length;
               }
               errorLineStr = ` на строке ${errorLine.toString()}`;
            }

            //error.filename может быть где-то в импортируемых лесс файлах. поэтому дублирования информации нет
            error.message = `Ошибка компиляции ${error.filename}${errorLineStr}: ${error.message}`;
            reject(error);
         }
      } catch (error) {
         reject(error);
      }
   });
}

function buildLess(filePath, text, resourcePath) {
   return new Promise(async function(resolve, reject) {
      try {
         const prettyFilePath = helpers.prettifyPath(filePath);
         const prettyResourcePath = helpers.prettifyPath(resourcePath);
         const theme = resolveThemeName(prettyFilePath, prettyResourcePath);
         try {
            resolve(await processLessFile(text, prettyFilePath, theme, prettyResourcePath));
         } catch (error) {
            reject(error);
         }
      } catch (error) {
         reject(error);
      }
   });
}

module.exports = buildLess;

