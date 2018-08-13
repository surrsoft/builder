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

async function processLessFile(data, filePath, theme, sbis3ControlsPath, pathsForImport, appRoot) {
   // если есть SBIS3.CONTROLS, то путь до его директори должен быть всегда перым,
   // чтобы избежать коллизии
   let preparedPathsForImport = pathsForImport;
   let isDefault = false;

   // если в проекте нет SBIS3.CONTROLS - это не проблема
   const imports = [];
   if (sbis3ControlsPath) {
      if (theme.path) {
         imports.push(`@import '${path.join(theme.path, '_variables')}';`);
      } else {
         isDefault = true;
         imports.push(`@import '${path.join('SBIS3.CONTROLS/themes', theme.name, '_variables')}';`);
      }
      imports.push(`@import '${path.join('SBIS3.CONTROLS/themes', '_mixins')}';`);
      preparedPathsForImport = [path.dirname(sbis3ControlsPath), ...pathsForImport];
   }
   imports.push(`@themeName: ${theme.name};`);
   const newData = [...imports, ...[data]].join('\n');
   try {
      const outputLess = await less.render(newData, {
         filename: filePath,
         cleancss: false,
         relativeUrls: true,
         strictImports: true,

         // так предписывает делать документация для поддержки js в less
         inlineJavaScript: true,

         // а так работает на самом деле поддержка js в less
         javascriptEnabled: true,
         paths: preparedPathsForImport
      });

      const processor = postcss([
         postcssUrl({
            url(asset) {
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
         autoprefixer({ browsers: ['last 2 versions', 'ie>=10'], remove: false })
      ]);
      const outputPostcss = await processor.process(outputLess.css, {
         parser: postcssSafeParser,
         from: filePath
      });

      return {
         text: outputPostcss.css,
         imports: outputLess.imports,
         nameTheme: theme.name,
         defaultTheme: isDefault
      };
   } catch (error) {
      if (error instanceof LessError) {
         // error.line может не существовать.
         let errorLineStr = '';
         if (error.hasOwnProperty('line') && typeof error.line === 'number') {
            let errorLine = error.line;
            if (
               helpers.prettifyPath(error.filename) === helpers.prettifyPath(filePath) &&
               errorLine >= imports.length
            ) {
               // сколько строк добавили в файл, столько и вычтем для вывода ошибки
               // в errorLine не должно быть отрицательных значений.
               errorLine -= imports.length;
            }
            errorLineStr = ` на строке ${errorLine.toString()}`;
         }

         // error.filename может быть где-то в импортируемых лесс файлах. поэтому дублирования информации нет
         const message = `Ошибка компиляции ${error.filename}${errorLineStr}: ${error.message}`;
         throw new Error(message);
      }
      throw error;
   }
}

function buildLess(filePath, text, modulePath, sbis3ControlsPath, pathsForImport, allThemes, appRoot) {
   const prettyRelativeFilePath = helpers.prettifyPath(path.relative(modulePath, filePath));
   const partsOfRelativeFilePath = prettyRelativeFilePath.split('/');
   if (path.basename(filePath).startsWith('_') || partsOfRelativeFilePath.includes('_less')) {
      return [{
         ignoreMessage: `Файл '${filePath}' не будет компилироваться.`
      }];
   }

   const prettyFilePath = helpers.prettifyPath(filePath);

   const prettyModulePath = helpers.prettifyPath(modulePath);
   const defaultModuleTheme = resolveThemeName(prettyFilePath, prettyModulePath);
   const prettySbis3ControlsPath = helpers.prettifyPath(sbis3ControlsPath);

   const buildAllThemes = [];
   buildAllThemes.push(processLessFile(text, prettyFilePath, {
      name: defaultModuleTheme
   }, prettySbis3ControlsPath, pathsForImport, appRoot));

   /**
    * less'ки непосредственно в папке themes нужно компилить исключительно без тем
    */
   if (allThemes && !prettyRelativeFilePath.includes('themes/')) {
      for (const themeName of Object.keys(allThemes)) {
         buildAllThemes.push(processLessFile(text, prettyFilePath, {
            name: themeName,
            path: allThemes[themeName]
         }, prettySbis3ControlsPath, pathsForImport, appRoot));
      }
   }

   return Promise.all(buildAllThemes);
}

module.exports = buildLess;
