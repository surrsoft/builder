'use strict';
const
   path = require('path'),
   helpers = require('../helpers'),
   builderConstants = require('../builder-constants'),
   { processLessFile } = require('./helpers'),
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
      autoprefixerOptions
   } = lessInfo;
   const startTime = Date.now();
   const prettyRelativeFilePath = helpers.prettifyPath(path.relative(modulePath, filePath));
   const prettyFilePath = helpers.prettifyPath(filePath);

   const prettyModulePath = helpers.prettifyPath(modulePath);
   const lessPromises = [];
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
               return Object.assign(defaultLessResult, { passedTime: Date.now() - startTime });
            }
            return {
               compiled: defaultLessResult,
               passedTime: Date.now() - startTime
            };
         } catch (error) {
            return {
               error: error.message,
               passedTime: Date.now() - startTime
            };
         }
      })());
   }
   const results = await Promise.all(lessPromises);
   return results;
}

module.exports = {
   resolveThemeName,
   buildLess
};
