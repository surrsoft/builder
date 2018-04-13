'use strict';
const less = require('less'),
   path = require('path'),
   helpers = require('../lib/helpers'),
   LessError = require('less/lib/less/less-error'),
   autoprefixer = require('autoprefixer'),
   postcss = require('postcss');

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
const themesForModules = new Map([['CloudControl', 'cloud'], ['Presto', 'presto'], ['Retail', 'carry']]);

//не все файлы в теме нужно компилировать
const filesForIgnoreInThemes = new Set([
   'variables.less',
   'mixin.less',
   'mixins.less',
   'theme.less',
   'header.less',
   'typography.less',
   'flex.less',
   'defaults.less',
   'theme-fixme.less',
   'sizes.less',
   'colors.less'
]);

/**
 @workaround ресолвим текущую тему по названию модуля или папке в темах
 */
function resolveThemeName(filePath, modulePath) {
   const relativePath = filePath.replace(modulePath, '');
   for (const themeName of themes) {
      if (relativePath.includes(`/themes/${themeName}/`)) {
         return themeName;
      }
   }
   const moduleName = path.basename(modulePath);
   if (themesForModules.has(moduleName)) {
      return themesForModules.get(moduleName);
   }
   return defaultTheme;
}

function processLessFile(data, filePath, theme, sbis3ControlsPath) {
   return new Promise(async function(resolve, reject) {
      try {
         if (filePath.includes('/themes/') && filesForIgnoreInThemes.has(path.basename(filePath))) {
            resolve({
               ignoreMessage: `Файл '${filePath}' не был скомпилирован, т.к. внесён в список для игнорирования.`
            });
            return;
         }

         //если в проекте нет SBIS3.CONTROLS - это не проблема
         let imports = [];
         if (sbis3ControlsPath) {
            const themesPath = path.join(sbis3ControlsPath, 'themes'),
               variablesPath = path.join(themesPath, theme, 'variables'),
               mixinsPath = path.join(themesPath, 'mixins');

            //в некоторых прикладных less есть импорт less из SBIS3.CONTROLS
            imports = [`@SBIS3CONTROLS: '${sbis3ControlsPath}';`,
               `@import '${variablesPath}';`, `@import '${mixinsPath}';`, `@themeName: ${theme};`];
         }
         const newData = [].concat(imports, [data]).join('\n');
         try {
            const outputLess = await less.render(newData, {
               filename: filePath,
               cleancss: false,
               relativeUrls: true,
               strictImports: true
            });

            const outputPostcss = await postcss([autoprefixer({ browsers: ['last 2 versions', 'ie>=10'] })]).process(
               outputLess.css
            );

            resolve({
               text: outputPostcss.css,
               imports: outputLess.imports
            });
         } catch (error) {
            if (error instanceof LessError) {
               //error.line может не существовать.
               let errorLineStr = '';
               if (error.hasOwnProperty('line') && typeof error.line === 'number') {
                  let errorLine = error.line;
                  if (
                     helpers.prettifyPath(error.filename) === helpers.prettifyPath(filePath) &&
                     errorLine >= imports.length
                  ) {
                     //сколько строк добавили в файл, столько и вычтем для вывода ошибки
                     //в errorLine не должно быть отрицательных значений.
                     errorLine -= imports.length;
                  }
                  errorLineStr = ` на строке ${errorLine.toString()}`;
               }

               //error.filename может быть где-то в импортируемых лесс файлах. поэтому дублирования информации нет
               const message = `Ошибка компиляции ${error.filename}${errorLineStr}: ${error.message}`;
               reject(new Error(message));
            } else {
               reject(error);
            }
         }
      } catch (error) {
         reject(error);
      }
   });
}

function buildLess(filePath, text, modulePath, sbis3ControlsPath) {
   return new Promise(async function(resolve, reject) {
      try {
         const prettyFilePath = helpers.prettifyPath(filePath);
         const prettyModulePath = helpers.prettifyPath(modulePath);
         const prettySbis3ControlsPath = helpers.prettifyPath(sbis3ControlsPath);

         const theme = resolveThemeName(prettyFilePath, prettyModulePath);
         try {
            resolve(await processLessFile(text, prettyFilePath, theme, prettySbis3ControlsPath));
         } catch (error) {
            reject(error);
         }
      } catch (error) {
         reject(error);
      }
   });
}

module.exports = buildLess;
