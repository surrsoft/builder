/**
 * Плагин для компиляции less.
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate'),
   pMap = require('p-map'),
   helpers = require('../../../lib/helpers'),
   Vinyl = require('vinyl'),
   fs = require('fs-extra'),
   { buildLess } = require('../../../lib/build-less'),
   { defaultAutoprefixerOptions } = require('../../../lib/builder-constants'),
   cssExt = /\.css$/;

/**
 * Получаем путь до скомпиленного css в конечной директории относительно
 * корня приложения.
 * @param {Object} moduleInfo - базовая информация об Интерфейсном модуле
 * @param {String} prettyFilePath - отформатированный путь до css-файла.
 * @returns {*}
 */
function getRelativeOutput(moduleInfo, prettyFilePath) {
   const { moduleName, prettyModuleOutput } = moduleInfo;
   const relativePath = path.relative(prettyModuleOutput, prettyFilePath);
   return path.join(moduleName, relativePath).replace(/\.css$/, '.min.css');
}

/**
 * Get interface module name from failed less path
 * @param{String} currentLessBase - path to current less interface module
 * @param{String} failedLessPath - full path to failed less
 * @returns {*}
 */
function getModuleNameForFailedImportLess(currentLessBase, failedLessPath) {
   const root = helpers.unixifyPath(path.dirname(currentLessBase));
   const prettyFailedLessPath = helpers.unixifyPath(failedLessPath);
   const prettyRelativePath = helpers.removeLeadingSlashes(
      prettyFailedLessPath.replace(root, '')
   );
   return prettyRelativePath.split('/').shift();
}

/**
 * В случае отсутствия в Интерфейсном модуле конфигурации темизации less
 * файлов, генерируем базовую конфигурацию:
 * 1) Генерируем все less-ки Интерфейсного модуля по старой схеме темизации
 * 2) Не билдим все less-ки Интерфейсного модуля по новой схеме темизации
 */
function setDefaultLessConfiguration() {
   return {
      old: true,
      multi: false
   };
}

/**
 * Check current theme for new theme type
 * @param{Object} currentTheme - current theme info
 * @returns {boolean}
 */
function checkForNewThemeType(currentTheme) {
   /**
    * new themes can't be imported into any less by builder,
    * only physically import is allowed for it.
    */
   return currentTheme.type === 'new';
}

/**
 * Gets themes list for multi themes build
 * configuration
 * @param allThemes
 * @param taskParameters
 */
function getMultiThemesList(allThemes, themesParam) {
   const multiThemes = {};
   switch (typeof themesParam) {
      case 'boolean':
         if (themesParam) {
            Object.keys(allThemes).forEach((currentTheme) => {
               if (checkForNewThemeType(allThemes[currentTheme])) {
                  return;
               }
               multiThemes[currentTheme] = allThemes[currentTheme];
            });
         }
         break;

      // selected array of themes
      case 'object':
         if (themesParam instanceof Array === true) {
            Object.keys(allThemes).forEach((currentTheme) => {
               if (themesParam.includes(currentTheme)) {
                  if (checkForNewThemeType(allThemes[currentTheme])) {
                     return;
                  }
                  multiThemes[currentTheme] = allThemes[currentTheme];
               }
            });
         }
         break;
      default:
         break;
   }
   return multiThemes;
}

/**
 * gets new themes list
 * @param allThemes
 */
function getNewThemesList(allThemes) {
   const newThemes = {};
   Object.keys(allThemes).forEach((currentTheme) => {
      if (allThemes[currentTheme].type === 'new') {
         newThemes[currentTheme] = allThemes[currentTheme];
      }
   });
   return newThemes;
}

/**
 * Объявление плагина
 * @param {TaskParameters} taskParameters параметры для задач
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {string[]} pathsForImport пути, в которыи less будет искать импорты. нужно для работы межмодульных импортов.
 * @returns {stream}
 */
function compileLess(taskParameters, moduleInfo, gulpModulesInfo) {
   const getOutput = function(file, replacingExt) {
      const relativePath = path.relative(moduleInfo.path, file.history[0]).replace(/\.less$/, replacingExt);
      return path.join(moduleInfo.output, transliterate(relativePath));
   };
   const moduleLess = [];
   const allThemes = taskParameters.cache.currentStore.styleThemes;
   const moduleName = path.basename(moduleInfo.output);

   // check for offline plugin application
   const multiThemes = getMultiThemesList(allThemes, taskParameters.config.themes);
   const newThemes = getNewThemesList(allThemes);
   let autoprefixerOptions = false;
   switch (typeof taskParameters.config.autoprefixer) {
      case 'boolean':
         if (taskParameters.config.autoprefixer) {
            // set default by builder autoprefixer options
            autoprefixerOptions = defaultAutoprefixerOptions;
         } else {
            autoprefixerOptions = false;
         }
         break;
      case 'object':
         if (!(taskParameters.config.autoprefixer instanceof Array)) {
            autoprefixerOptions = taskParameters.config.autoprefixer;
         }
         break;
      default:
         break;
   }

   return through.obj(

      /* @this Stream */
      async function onTransform(file, encoding, callback) {
         try {
            let isLangCss = false;

            if (moduleInfo.contents.availableLanguage) {
               const avlLang = Object.keys(moduleInfo.contents.availableLanguage);
               isLangCss = avlLang.includes(file.basename.replace('.less', ''));
               file.isLangCss = isLangCss;
            }

            /**
             * always ignore css source files if the same .less source files exists
             */
            if (file.extname === '.css') {
               const lessInSource = await fs.pathExists(file.path.replace(cssExt, '.less'));
               if (lessInSource) {
                  const warnMessage = 'Compiled style from sources will be ignored: ' +
                     'current style will be compiled from less source analog';
                  logger.warning({
                     message: warnMessage,
                     filePath: file.path,
                     moduleInfo
                  });
                  callback(null);
                  return;
               }
               callback(null, file);
               return;
            }

            if (!file.path.endsWith('.less')) {
               callback(null, file);
               return;
            }

            /**
             * store every building less from new theme's interface modules
             * into builder cache to store theme into "contents" builder meta info
             */
            if (newThemes[moduleName] && !path.basename(file.path).startsWith('_')) {
               const prettyRelativePath = helpers.prettifyPath(path.relative(moduleInfo.path, file.path));
               const currentLessName = prettyRelativePath.replace('.less', '');

               taskParameters.cache.storeNewThemesModules(
                  newThemes[moduleName].moduleName,
                  currentLessName,
                  newThemes[moduleName].themeName
               );
            }

            if (file.cached) {
               taskParameters.cache.addOutputFile(file.history[0], getOutput(file, '.css'), moduleInfo);

               if (!isLangCss) {
                  Object.keys(allThemes).forEach((key) => {
                     taskParameters.cache.addOutputFile(file.history[0], getOutput(file, `_${key}.css`), moduleInfo);
                  });
               }

               callback(null, file);
               return;
            }
            moduleLess.push(file);
            callback(null);
         } catch (error) {
            taskParameters.cache.markFileAsFailed(file.history[0]);
            logger.error({
               message: 'Ошибка builder\'а при сборе less-файлов',
               error,
               moduleInfo,
               filePath: file.history[0]
            });
         }
      },

      /* @this Stream */
      async function onFlush(callback) {
         let moduleLessConfig = taskParameters.cache.getModuleLessConfiguration(moduleInfo.name);
         if (!moduleLessConfig) {
            moduleLessConfig = setDefaultLessConfiguration();
         }
         const
            prettyModuleOutput = helpers.prettifyPath(moduleInfo.output),
            needSaveImportLogs = taskParameters.config.logFolder && moduleLessConfig.importsLogger;

         let compiledLess = new Set();

         /**
          * если уже существует мета-файл по результатам предыдущей сборки, необходимо
          * прочитать его и дополнить новыми скомпилированными стилями.
          */
         if (await fs.pathExists(path.join(moduleInfo.output, '.builder/compiled-less.min.json'))) {
            compiledLess = new Set(await fs.readJson(path.join(moduleInfo.output, '.builder/compiled-less.min.json')));
         }

         /**
          * Если разработчиком в конфигурации less задан параметр для логгирования импортов для
          * компилируемого less, создаём json-лог и пишем его в директорию логов с названием соответствующего
          * Интерфейсного модуля. Если такой лог уже существует, предварительно вычитываем его и меняем набор
          * импортов изменённых less(для инкрементальной сборки).
          */
         let lessImportsLogs = {}, lessImportsLogsPath;
         if (needSaveImportLogs) {
            lessImportsLogsPath = path.join(taskParameters.config.logFolder, `less-imports-for-${moduleName}.json`);
            if (await fs.pathExists(lessImportsLogsPath)) {
               lessImportsLogs = await fs.readJson(lessImportsLogsPath);
            }
         }
         let errors = false;
         await pMap(
            moduleLess,
            async(currentLessFile) => {
               try {
                  const lessInfo = {
                     filePath: currentLessFile.history[0],
                     modulePath: moduleInfo.path,
                     text: currentLessFile.contents.toString(),
                     themes: taskParameters.config.themes,
                     moduleLessConfig,
                     multiThemes,
                     newThemes,
                     autoprefixerOptions
                  };
                  const results = await buildLess(
                     {
                        pool: taskParameters.pool,
                        fileSourcePath: currentLessFile.history[0],
                        moduleInfo
                     },
                     lessInfo,
                     gulpModulesInfo,
                     currentLessFile.isLangCss,
                     allThemes
                  );
                  for (const result of results) {
                     if (result.ignoreMessage) {
                        logger.debug(result.ignoreMessage);
                     } else if (result.error) {
                        let errorObject;
                        if (result.failedLess) {
                           const moduleNameForFail = getModuleNameForFailedImportLess(
                              currentLessFile.base,
                              result.failedLess
                           );
                           const moduleInfoForFail = taskParameters.config.modules.find(
                              currentModuleInfo => currentModuleInfo.name === moduleNameForFail
                           );
                           const errorLoadAttempts = result.error.slice(result.error.indexOf('Tried -'), result.error.length);
                           result.error = result.error.replace(errorLoadAttempts, '');

                           const message = `Bad import detected ${result.error}. Check interface module of current import ` +
                              `for existing in current project. Needed by: ${currentLessFile.history[0]}. ` +
                              `For theme: ${result.theme.name}. Theme type: ${result.theme.isDefault ? 'old' : 'new'}\n${errorLoadAttempts}`;
                           errorObject = {
                              message,
                              filePath: result.failedLess,
                              moduleInfo: moduleInfoForFail
                           };
                        } else {
                           errorObject = {
                              message: `Ошибка компиляции less: ${result.error}`,
                              filePath: currentLessFile.history[0],
                              moduleInfo
                           };
                        }
                        logger.error(errorObject);
                        errors = true;
                        taskParameters.cache.markFileAsFailed(currentLessFile.history[0]);
                     } else {
                        const { compiled } = result;
                        const outputPath = getOutput(currentLessFile, compiled.defaultTheme ? '.css' : `_${compiled.nameTheme}.css`);

                        /**
                         * Мета-данные о скомпилированных less нужны только во время
                         * выполнения кастомной паковки
                         */
                        if (taskParameters.config.customPack) {
                           const relativeOutput = helpers.unixifyPath(
                              getRelativeOutput(
                                 { moduleName, prettyModuleOutput },
                                 helpers.unixifyPath(outputPath)
                              )
                           );
                           compiledLess.add(relativeOutput);
                        }
                        taskParameters.cache.addOutputFile(currentLessFile.history[0], outputPath, moduleInfo);
                        taskParameters.cache.addDependencies(currentLessFile.history[0], compiled.imports);

                        const newFile = currentLessFile.clone();
                        newFile.contents = Buffer.from(compiled.text);
                        newFile.path = outputPath;
                        newFile.base = moduleInfo.output;
                        newFile.lessSource = currentLessFile.contents;
                        this.push(newFile);

                        if (needSaveImportLogs) {
                           lessImportsLogs[outputPath] = {
                              importedByBuilder: compiled.importedByBuilder,
                              allImports: compiled.imports
                           };
                        }
                     }
                  }
               } catch (error) {
                  taskParameters.cache.markFileAsFailed(currentLessFile.history[0]);
                  logger.error({
                     message: 'Ошибка builder\'а при компиляции less',
                     error,
                     moduleInfo,
                     filePath: currentLessFile.history[0]
                  });
               }
               this.push(currentLessFile);
            },
            {
               concurrency: 20
            }
         );
         if (errors) {
            logger.info(`Информация об Интерфейсных модулей для компилятора less: ${JSON.stringify(gulpModulesInfo)}`);
         }
         if (taskParameters.config.customPack) {
            const jsonFile = new Vinyl({
               path: '.builder/compiled-less.min.json',
               contents: Buffer.from(JSON.stringify([...compiledLess].sort(), null, 2)),
               moduleInfo
            });
            this.push(jsonFile);
         }

         if (needSaveImportLogs) {
            await fs.outputJson(lessImportsLogsPath, lessImportsLogs);
         }
         callback();
      }
   );
}

module.exports = {
   compileLess,
   getMultiThemesList,
   checkForNewThemeType
};
