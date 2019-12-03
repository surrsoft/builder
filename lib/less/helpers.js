'use strict';

const
   path = require('path'),
   builderConstants = require('../builder-constants'),
   helpers = require('../helpers'),
   less = require('less'),
   autoprefixer = require('autoprefixer'),
   postcss = require('postcss'),
   postcssSafeParser = require('postcss-safe-parser'),
   LessError = require('less/lib/less/less-error');

/**
 * get variables import in dependency of:
 * 1) project has SBIS3.CONTROLS module:
 * 1.1) less config has variables option with value "Controls-theme":
 *    get import from Controls-theme
 * 1.2) in other cases get variables from SBIS3.CONTROLS.
 * 2) project don't have SBIS3.CONTROLS module
 * 1.1) get variables from Controls-theme if project has it.
 * 1.2) don't get variables if Controls-theme doesn't exists in current project
 */
function getThemeImport(theme, controlsThemeIncluded) {
   const importLessName = builderConstants.oldThemes.includes(theme.name) ? '_variables' : theme.name;
   if (theme.isDefault && theme.variablesFromLessConfig === 'Controls-theme') {
      return '@import \'Controls-theme/themes/default/default\';';
   }
   if (theme.path) {
      return `@import '${helpers.unixifyPath(path.join(theme.path, importLessName))}';`;
   }
   if (controlsThemeIncluded) {
      return `@import 'Controls-theme/themes/default/${importLessName}';`;
   }
   return '';
}

/**
 * get compiler result for current less and post-process it with autoprefixer.
 * @param{String} lessContent - current less content
 * @param{String} filePath - path to current less
 * @param{Object} pathsForImport - meta data for interface modules physical paths
 * @param{Object} theme - current theme meta data
 * @param{Object} imports - current less imports added by builder
 */
async function getCompiledLess(lessContent, filePath, pathsForImport, theme, imports, autoprefixerOptions) {
   const outputLess = await less.render(lessContent, {
      filename: filePath,
      cleancss: false,
      relativeUrls: true,
      strictImports: true,

      // так предписывает делать документация для поддержки js в less
      inlineJavaScript: true,

      // а так работает на самом деле поддержка js в less
      javascriptEnabled: true,
      paths: pathsForImport
   });

   let result;

   /**
    * post-process less result if autoprefixer enabled
    */
   if (autoprefixerOptions) {
      const processor = postcss([
         autoprefixer(autoprefixerOptions)
      ]);
      const postCssResult = await processor.process(
         outputLess.css,
         {
            parser: postcssSafeParser,
            from: filePath
         }
      );
      result = postCssResult.css;
   } else {
      result = outputLess.css;
   }

   return {
      text: result,
      imports: outputLess.imports,
      nameTheme: theme.name,
      defaultTheme: theme.isDefault || theme.type === 'new',
      importedByBuilder: imports
   };
}

/**
 * Returns imports from builder for current less.
 * build less files without any extra imports from builder in next cases:
 * 1) for new themes
 * 2) for old theme less building(f.e. genie.less, online.less, presto.less, etc.)
 * @param filePath
 * @param theme
 * @param gulpModulesPaths
 * @returns {Array}
 */
function getCurrentImports(filePath, theme, gulpModulesPaths) {
   const imports = [];
   if (theme.type === 'new') {
      return imports;
   }

   /**
    * theme object can be defined without path for it. Example - default theme resolved as 'online'(for old theme build
    * theme resolves to online as default), but interface module 'SBIS3.CONTROLS'(source of theme online) doenst exists
    * in current project.
    */
   if (theme.path && filePath === `${helpers.unixifyPath(path.join(theme.path, theme.name))}.less`) {
      return imports;
   }
   const controlsThemeIncluded = gulpModulesPaths.hasOwnProperty('Controls-theme');
   const variablesImport = getThemeImport(theme, controlsThemeIncluded);
   if (variablesImport) {
      imports.push(variablesImport);
   }
   if (controlsThemeIncluded) {
      imports.push('@import \'Controls-theme/themes/default/helpers/_mixins\';');
   }
   imports.push(`@themeName: ${theme.name};`);
   return imports;
}


async function processLessFile(data, filePath, theme, gulpModulesInfo, autoprefixerOptions) {
   const { pathsForImport, gulpModulesPaths } = gulpModulesInfo;
   const imports = getCurrentImports(filePath, theme, gulpModulesPaths);

   const newData = [...imports, ...[data]].join('\n');
   let lessResult;
   try {
      lessResult = await getCompiledLess(newData, filePath, pathsForImport, theme, imports, autoprefixerOptions);
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
            errorLineStr = ` in line ${errorLine.toString()}`;
         }

         /**
          * failed file import will not be existing in current error only
          * in case of less compiler error
           */
         if (!error.filename) {
            return {
               error: error.message,
               compilerError: true,
               theme
            };
         }

         if (error.type === 'File') {
            return {
               error: `${errorLineStr}: ${error.message}`,
               failedLess: error.filename,
               type: 'import',
               theme
            };
         }

         // error.filename может быть где-то в импортируемых лесс файлах. поэтому дублирования информации нет
         const message = `Error compiling less for theme ${theme.name}` +
            `(${theme.isDefault ? 'old' : 'new'} theme type): ${errorLineStr}: ${error.message}`;
         return {
            error: message,
            failedLess: error.filename,
            type: 'common',
            theme
         };
      }
      throw error;
   }
   return lessResult;
}

module.exports = {
   getThemeImport,
   getCurrentImports,
   processLessFile
};
