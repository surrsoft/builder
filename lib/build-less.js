'use strict';
const less = require('less'),
   path = require('path'),
   helpers = require('../lib/helpers'),
   LessError = require('less/lib/less/less-error'),
   autoprefixer = require('autoprefixer'),
   postcss = require('postcss'),
   postcssSafeParser = require('postcss-safe-parser'),
   postcssUrl = require('postcss-url'),
   execInPool = require('../gulp/common/exec-in-pool'),
   pMap = require('p-map'),
   builderConstants = require('./builder-constants'),
   minimatch = require('minimatch');

const invalidUrl = /^(\/|#|data:|[a-z]+:\/\/)(?=.*)/i;
const defaultTheme = 'online';
const themesForModules = new Map([['CloudControl', 'cloud'], ['Presto', 'presto'], ['Retail', 'carry']]);
const browsersList = [
   'Chrome>=32',
   'Firefox>=26',
   'ie>=10',
   'iOS>=10',
   'Opera>=18',
   'Safari>=6.0',
   'Edge>=12'
];

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

async function processLessFile(data, filePath, theme, gulpModulesInfo, appRootParams) {
   const { isMultiService, applicationRoot, resourcesUrl } = appRootParams;
   const { pathsForImport, gulpModulesPaths } = gulpModulesInfo;
   const imports = [];

   const controlsThemeIncluded = gulpModulesPaths.hasOwnProperty('Controls-theme');
   const variablesImport = getThemeImport(theme, controlsThemeIncluded);
   if (variablesImport) {
      imports.push(variablesImport);
   }
   if (controlsThemeIncluded) {
      imports.push('@import \'Controls-theme/themes/default/helpers/_mixins\';');
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
         paths: pathsForImport
      });

      const processor = postcss([
         postcssUrl({
            url(asset) {
               // ignore absolute urls, hashes or data uris
               if (invalidUrl.test(asset.url)) {
                  return asset.url;
               }

               /**
                * Для онлайн-розницы пути до иконок разрешаются неправильно, поскольку:
                * 1) Собирается в рамках online-inside, который является мультисервисным, а для
                * мультисервисных приложений разрешать линки до абсолютных путей нельзя, поскольку
                * сервис определяется динамически Сервисом Представлений
                * 2) UI-модули проекта лежат на разных уровнях вложенности, поскольку берутся напрямую
                * из выкачанных репозиториев git'а, а платформа и вовсе из SDK.Для постоянного решения подобной проблемы
                * нужно перенастроить сборку, как вариант, все Интерфейсные модули линковать из гитовых исходников
                * в 1 обшую бабку InterfaceModules, и уже данные пути передавать сборщику. Например, раньше все темы
                * лежали в SBIS3.CONTROLS, иконки лежат в Controls-theme, оба этих модуля лежат в SDK на 1 уровне
                * вложенности, а значит и относительные пути до иконок будут разрешены правильно.
                */
               if (asset.url.includes('..') && asset.url.includes('/link_to_sdk/ui-modules/Controls-theme/')) {
                  let newFolder = 'Controls-theme';
                  if (applicationRoot && applicationRoot !== '/') {
                     newFolder = helpers.prettifyPath(path.join(applicationRoot, newFolder));
                  }
                  return asset.url.replace(/.*\/Controls-theme/, newFolder);
               }
               if (asset.url.includes('..') && asset.url.includes('/retail_themes/Retail-theme/')) {
                  let newFolder = 'Retail-theme';
                  if (applicationRoot && applicationRoot !== '/') {
                     newFolder = helpers.prettifyPath(path.join(applicationRoot, newFolder));
                  }
                  return asset.url.replace(/.*\/Retail-theme/, newFolder);
               }
               if (asset.url.includes('..') && asset.url.includes('/showcase-service/client/ShowCaseOnline/')) {
                  let newFolder = 'ShowCaseOnline';
                  if (applicationRoot && applicationRoot !== '/') {
                     newFolder = helpers.prettifyPath(path.join(applicationRoot, newFolder));
                  }
                  return asset.url.replace(/.*?\/ShowCaseOnline/, newFolder);
               }

               // из-за того, что less компилируются из исходников, а не из стенда,
               // в СБИС плаигне при импорте less из SBIS.CONTROLS получаются кривые пути
               // Для мультисервисных приложений урлы трогать нельзя.
               if (asset.url.includes('..') && !isMultiService) {
                  if (asset.url.includes('/SBIS3.CONTROLS/')) {
                     let newFolder = 'SBIS3.CONTROLS';
                     if (applicationRoot && applicationRoot !== '/') {
                        newFolder = helpers.prettifyPath(path.join(applicationRoot, newFolder));
                     }
                     if (!resourcesUrl) {
                        newFolder = `/${newFolder}`;
                     }
                     return asset.url.replace(/.*SBIS3\.CONTROLS/, newFolder);
                  }
                  if (asset.url.includes('/ui-modules/Controls/')) {
                     let newFolder = 'Controls';
                     if (applicationRoot && applicationRoot !== '/') {
                        newFolder = helpers.prettifyPath(path.join(applicationRoot, newFolder));
                     }
                     if (!resourcesUrl) {
                        newFolder = `/${newFolder}`;
                     }
                     return asset.url.replace(/.*\/ui-modules\/Controls/, newFolder);
                  }
                  if (asset.url.includes('/Controls-theme/')) {
                     let newFolder = 'Controls-theme';
                     if (applicationRoot && applicationRoot !== '/') {
                        newFolder = helpers.prettifyPath(path.join(applicationRoot, newFolder));
                     }
                     if (!resourcesUrl) {
                        newFolder = `/${newFolder}`;
                     }
                     return asset.url.replace(/.*\/Controls-theme/, newFolder);
                  }
                  if (asset.url.includes('/Retail-theme/')) {
                     let newFolder = 'Retail-theme';
                     if (applicationRoot && applicationRoot !== '/') {
                        newFolder = helpers.prettifyPath(path.join(applicationRoot, newFolder));
                     }
                     if (!resourcesUrl) {
                        newFolder = `/${newFolder}`;
                     }
                     return asset.url.replace(/.*\/Retail-theme/, newFolder);
                  }
               }
               return asset.url;
            }
         }),
         autoprefixer({ browsers: browsersList, remove: false })
      ]);
      if (filePath.includes('themes')) {
         /**
          * надо поменять папку с путём до SDK, поскольку ")" является признаком конца урла в postcss-url,
          * а encodeURI не принесёт результата, поскольку ")" является валидной частью запроса и
          * не экранируется с помощью функций encodeURI и encodeURIComponent
          * TODO сделать более красиво, можно например засимлинкать модули из SDK в директорию без ")"
          */
         outputLess.css = outputLess.css.replace(/\/Program\\? Files\\? \\?\(x86\\?\)\//g, '/temp_form_sdk/');
      }
      const outputPostcss = await processor.process(
         outputLess.css,
         {
            parser: postcssSafeParser,
            from: filePath
         }
      );

      return {
         text: outputPostcss.css,
         imports: outputLess.imports,
         nameTheme: theme.name,
         defaultTheme: theme.isDefault,
         importedByBuilder: imports
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
            errorLineStr = ` in line ${errorLine.toString()}`;
         }

         // error.filename может быть где-то в импортируемых лесс файлах. поэтому дублирования информации нет
         const message = `Error compiling less: "${error.filename}" for theme ${theme.name}` +
            `(${theme.isDefault ? 'old' : 'new'} theme type): ${errorLineStr}: ${error.message}`;
         throw new Error(message);
      }
      throw error;
   }
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
   paramsForWorker,
   lessInfo,
   gulpModulesInfo,
   notThemedLess,
   styleThemes,
   appRootParams
) {
   const { pool, fileSourcePath, moduleInfo } = paramsForWorker;
   const {
      filePath,
      text,
      modulePath,
      moduleLessConfig
   } = lessInfo;
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
   const results = [];
   if (validateLessPathForCurrentConfig(prettyRelativeFilePath, moduleLessConfig, 'old')) {
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
      const [defaultLessError, defaultLessResult] = await execInPool(
         pool,
         'processLessFile',
         [
            text,
            prettyFilePath,
            defaultModuleThemeObject,
            gulpModulesInfo,
            appRootParams || {}
         ],
         fileSourcePath,
         moduleInfo
      );

      /**
       * нужно выводить ошибку из пулла, это будет означать неотловленную ошибку,
       * и она не будет связана с ошибкой компиляции непосредственно less-файла.
       */
      if (defaultLessError) {
         results.push({
            error: defaultLessError.message
         });
      } else {
         results.push({
            compiled: defaultLessResult
         });
      }
   }

   /**
    * less'ки непосредственно в папке ${UI-module}/themes нужно компилить исключительно без тем.
    * Данное правило будет железно зашито в билдере, чтобы разработчики через конфиг случайно не могли
    * себе нагенерировать темы для тем.
    */
   if (!notThemedLess && !prettyRelativeFilePath.startsWith('themes/') &&
      validateLessPathForCurrentConfig(prettyRelativeFilePath, moduleLessConfig, 'multi')) {
      await pMap(
         Object.keys(styleThemes),
         async(themeName) => {
            const currentTheme = {
               name: themeName,
               path: styleThemes[themeName].path
            };
            if (styleThemes[themeName].hasOwnProperty('config')) {
               currentTheme.config = styleThemes[themeName].config;
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
               const [themedLessError, themedLessResult] = await execInPool(
                  pool,
                  'processLessFile',
                  [
                     text,
                     prettyFilePath,
                     currentTheme,
                     gulpModulesInfo,
                     appRootParams || {}
                  ],
                  fileSourcePath,
                  moduleInfo
               );
               if (themedLessError) {
                  results.push({
                     error: themedLessError.message
                  });
               } else {
                  results.push({
                     compiled: themedLessResult
                  });
               }
            }
         },
         {
            concurrency: 20
         }
      );
   }
   return results;
}

module.exports = {
   processLessFile,
   resolveThemeName,
   buildLess,
   getThemeImport
};
