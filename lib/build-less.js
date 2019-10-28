'use strict';
const less = require('less'),
   path = require('path'),
   helpers = require('../lib/helpers'),
   LessError = require('less/lib/less/less-error'),
   autoprefixer = require('autoprefixer'),
   postcss = require('postcss'),
   postcssSafeParser = require('postcss-safe-parser'),
   builderConstants = require('./builder-constants'),
   minimatch = require('minimatch');

const defaultTheme = 'online';
const themesForModules = new Map([
   ['CloudControl', 'cloud'],
   ['Presto', 'presto'],
   ['Retail', 'carry'],
   ['Genie', 'genie']
]);

/**
 * Проверяет less-ку на совпадение хотя бы одному заданному паттерну.
 * Может принимать как массив паттернов, так и одиночный паттерн.
 * @param filePath
 * @param patterns
 * @returns {boolean}
 */
function multiMatch(filePath, patterns) {
   let result = false;
   switch (typeof patterns) {
      case 'string':
         result = minimatch(filePath, patterns);
         break;
      case 'object':
         patterns.forEach((pattern) => {
            if (minimatch(filePath, pattern)) {
               result = true;
            }
         });
         break;
      default:
         break;
   }
   return result;
}

/**
 @workaround ресолвим текущую тему по названию модуля или папке в темах
 */
function resolveThemeName(filePath, modulePath) {
   const relativePath = filePath.replace(modulePath, '');
   for (const themeName of builderConstants.oldThemes) {
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

         if (error.type === 'File') {
            return {
               error: `${errorLineStr}: ${error.message}`,
               failedLess: error.filename,
               theme
            };
         }

         // error.filename может быть где-то в импортируемых лесс файлах. поэтому дублирования информации нет
         const message = `Error compiling less: "${error.filename}" for theme ${theme.name}` +
            `(${theme.isDefault ? 'old' : 'new'} theme type): ${errorLineStr}: ${error.message}`;
         throw new Error(message);
      }
      throw error;
   }
   return lessResult;
}

/**
 * В случае если в конфигурации заданы glob-маски, проверяем путь на
 * совпадение заданным разработчиком паттернам
 * @param relativePath
 * @param moduleLessConfig
 */
function validateLessPathForCurrentConfig(relativePath, moduleLessConfig, processThemesType) {
   const processThemesValue = moduleLessConfig[processThemesType];
   let result = false;
   switch (typeof processThemesValue) {
      case 'boolean':
         result = processThemesValue;
         break;

      /**
       * в качестве множественных паттернов у нас выступает объект с набором паттернов, по которым
       * можно включать файл - include. И набор паттернов, по которым файл должен быть исключён -
       * exclude
       */
      case 'object':
         result = multiMatch(relativePath, processThemesValue.include) &&
            !multiMatch(relativePath, processThemesValue.exclude);
         break;

      // остаётся одиночный паттерн
      default:
         result = multiMatch(relativePath, processThemesValue);
         break;
   }
   return result;
}

function getCompatibilityGlob(relativePath, compatibityLayer) {
   let result = '';
   Object.keys(compatibityLayer).forEach((currentGlob) => {
      if (multiMatch(relativePath, currentGlob)) {
         result = currentGlob;
      }
   });
   return result;
}

/**
 * Проверяем тему на совместимость с текущим Интерфейсным модулем.
 */
function validateCompatibilityOfTheme(relativePath, themeParams, moduleConfig) {
   const themeCompatibilityTags = themeParams.config && themeParams.config.tags;
   let result = false, validatedGlob;
   switch (typeof moduleConfig.compatibility) {
      case 'boolean':
         result = moduleConfig.compatibility;
         break;
      case 'object':
         validatedGlob = getCompatibilityGlob(relativePath, moduleConfig.compatibility);

         /**
          * В случае наличия наличия подходящей маски в слое совместимости для текущей lessки,
          * проверяем тему на наличие нужных тегов совместимости, в противном случае считаем, что
          * lessка совместима со всеми темами, найденными в проекте.
          */
         if (validatedGlob) {
            themeCompatibilityTags.forEach((currentThemeTag) => {
               if (moduleConfig.compatibility[validatedGlob].includes(currentThemeTag)) {
                  result = true;
               }
            });
         } else {
            result = true;
         }
         break;
      default:
         break;
   }
   return result;
}

async function buildLess(
   lessInfo,
   gulpModulesInfo,
   notThemedLess,
   styleThemes
) {
   const {
      filePath,
      text,
      modulePath,
      moduleLessConfig,
      newThemes,
      autoprefixerOptions
   } = lessInfo;
   const prettyRelativeFilePath = helpers.prettifyPath(path.relative(modulePath, filePath));
   const prettyFilePath = helpers.prettifyPath(filePath);

   const prettyModulePath = helpers.prettifyPath(modulePath);
   const moduleName = path.basename(modulePath);
   const lessPromises = [];
   if (newThemes[moduleName]) {
      lessPromises.push((async() => {
         try {
            const newThemeLessResult = await processLessFile(
               text,
               prettyFilePath,
               newThemes[moduleName],
               gulpModulesInfo,
               autoprefixerOptions
            );
            if (newThemeLessResult.error) {
               return newThemeLessResult;
            }
            return {
               compiled: newThemeLessResult,
               moduleName,
               themeName: newThemes[moduleName]
            };
         } catch (error) {
            return { error: error.message };
         }
      })());
   } else {
      const defaultModuleTheme = resolveThemeName(prettyFilePath, prettyModulePath);
      if (validateLessPathForCurrentConfig(prettyRelativeFilePath, moduleLessConfig, 'old')) {
         lessPromises.push((async() => {
            const defaultModuleThemeObject = {
               name: defaultModuleTheme,
               isDefault: true,
               variablesFromLessConfig: moduleLessConfig.old.variables
            };
            if (styleThemes.hasOwnProperty(defaultModuleTheme)) {
               defaultModuleThemeObject.path = styleThemes[defaultModuleTheme].path;
               if (styleThemes[defaultModuleTheme].hasOwnProperty('config')) {
                  defaultModuleThemeObject.config = styleThemes[defaultModuleTheme].config;
               }
            }

            try {
               const defaultLessResult = await processLessFile(
                  text,
                  prettyFilePath,
                  defaultModuleThemeObject,
                  gulpModulesInfo,
                  autoprefixerOptions
               );
               if (defaultLessResult.error) {
                  return defaultLessResult;
               }
               return { compiled: defaultLessResult };
            } catch (error) {
               return { error: error.message };
            }
         })());
      }

      /**
       * less'ки непосредственно в папке ${UI-module}/themes нужно компилить исключительно без тем.
       * Данное правило будет железно зашито в билдере, чтобы разработчики через конфиг случайно не могли
       * себе нагенерировать темы для тем.
       */
      if (!notThemedLess && !prettyRelativeFilePath.includes('themes/') &&
         validateLessPathForCurrentConfig(prettyRelativeFilePath, moduleLessConfig, 'multi')) {
         const multiThemes = lessInfo.multiThemes ? lessInfo.multiThemes : styleThemes;
         Object.keys(multiThemes).forEach((themeName) => {
            const currentTheme = {
               name: themeName,
               path: multiThemes[themeName].path
            };
            if (multiThemes[themeName].hasOwnProperty('config')) {
               currentTheme.config = multiThemes[themeName].config;
            }

            /**
             * В случае наличия в конфигурации слоя совместимости и отсутствия
             * для темы описания тегов совместимости, тема игнорируется для текущего
             * Интерфейсного модуля.
             */
            if (typeof moduleLessConfig.compatibility === 'object' && !currentTheme.config) {
               return;
            }
            if (validateCompatibilityOfTheme(prettyRelativeFilePath, currentTheme, moduleLessConfig)) {
               lessPromises.push((async() => {
                  try {
                     const themedLessResult = await processLessFile(
                        text,
                        prettyFilePath,
                        currentTheme,
                        gulpModulesInfo,
                        autoprefixerOptions
                     );
                     if (themedLessResult.error) {
                        return themedLessResult;
                     }
                     return { compiled: themedLessResult };
                  } catch (error) {
                     return { error: error.message };
                  }
               })());
            }
         });
      }
   }
   const results = await Promise.all(lessPromises);
   return results;
}

module.exports = {
   processLessFile,
   resolveThemeName,
   buildLess,
   getThemeImport,
   getCurrentImports
};
