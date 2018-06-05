'use strict';
const less = require('less'),
   path = require('path'),
   helpers = require('../lib/helpers'),
   LessError = require('less/lib/less/less-error'),
   autoprefixer = require('autoprefixer'),
   postcss = require('postcss'),
   postcssSafeParser = require('postcss-safe-parser'),
   postcssUrl = require('postcss-url');

const invalidUrl = /^(\/|#|data:|[a-z]+:\/\/)(?=.*)/i;

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

function processLessFile(data, filePath, theme, sbis3ControlsPath, pathsForImport, appRoot) {
   return new Promise(async function(resolve, reject) {
      try {
         if (path.basename(filePath).startsWith('_') || path.basename(path.dirname(filePath)) === '_less') {
            resolve({
               ignoreMessage: `Файл '${filePath}' не будет компилироваться.`
            });
            return;
         }

         //если есть SBIS3.CONTROLS, то путь до его директори должен быть всегда перым,
         //чтобы избежать коллизии
         let preparedPathsForImport = pathsForImport;

         //если в проекте нет SBIS3.CONTROLS - это не проблема
         let imports = [];
         if (sbis3ControlsPath) {
            const themesPath = 'SBIS3.CONTROLS/themes';
            const variablesPath = path.join(themesPath, theme, '_variables'),
               mixinsPath = path.join(themesPath, '_mixins');

            imports = [
               `@import '${variablesPath}';`,
               `@import '${mixinsPath}';`,
               `@themeName: ${theme};`
            ];
            preparedPathsForImport = [path.dirname(sbis3ControlsPath), ...pathsForImport];
         }
         const newData = [].concat(imports, [data]).join('\n');
         try {
            const outputLess = await less.render(newData, {
               filename: filePath,
               cleancss: false,
               relativeUrls: true,
               strictImports: true,
               inlineJavaScript: true, //так предписывает делать документация для поддержки js в less
               javascriptEnabled: true, //а так работает на самом деле поддержка js в less
               paths: preparedPathsForImport
            });

            const processor = postcss([
               postcssUrl({
                  url: function(asset) {
                     // ignore absolute urls, hashes or data uris
                     if (invalidUrl.test(asset.url)) {
                        return asset.url;
                     }

                     // из-за того, что less компилируются из исходников, а не из стенда,
                     // в СБИС плаигне при импорте less из SBIS.CONTROLS получаются кривые пути
                     if (asset.url.includes('..')) {
                        if (asset.url.includes('/SBIS3.CONTROLS/')) {
                           let newFolder = '/resources/SBIS3.CONTROLS';
                           if (appRoot && appRoot !== '/') {
                              newFolder = helpers.prettifyPath(path.join(appRoot, newFolder));
                           }
                           return asset.url.replace(/.*SBIS3\.CONTROLS/, newFolder);
                        }
                        if (asset.url.includes('/ui-modules/Controls/')) {
                           let newFolder = '/resources/Controls';
                           if (appRoot && appRoot !== '/') {
                              newFolder = helpers.prettifyPath(path.join(appRoot, newFolder));
                           }
                           return asset.url.replace(/.*\/ui-modules\/Controls/, newFolder);
                        }
                     }
                     return asset.url;
                  }
               }),
               autoprefixer({browsers: ['last 2 versions', 'ie>=10'], remove: false})
            ]);
            const outputPostcss = await processor.process(outputLess.css, {
               parser: postcssSafeParser,
               from: filePath
            });

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

function buildLess(filePath, text, modulePath, sbis3ControlsPath, pathsForImport, appRoot) {
   return new Promise(async function(resolve, reject) {
      try {
         const prettyFilePath = helpers.prettifyPath(filePath);
         const prettyModulePath = helpers.prettifyPath(modulePath);
         const prettySbis3ControlsPath = helpers.prettifyPath(sbis3ControlsPath);

         const theme = resolveThemeName(prettyFilePath, prettyModulePath);
         try {
            resolve(
               await processLessFile(text, prettyFilePath, theme, prettySbis3ControlsPath, pathsForImport, appRoot)
            );
         } catch (error) {
            reject(error);
         }
      } catch (error) {
         reject(error);
      }
   });
}

module.exports = buildLess;
