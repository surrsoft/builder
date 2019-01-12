/**
 * Плагин для компиляции less.
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate'),
   execInPool = require('../../common/exec-in-pool'),
   pMap = require('p-map'),
   helpers = require('../../../lib/helpers');

/**
 * Проверяем, необходима ли темизация конкретной lessки по
 * её наличию less в наборе темизируемых less, полученных
 * в процессе анализа зависимостей компонентов
 * @param {Vinyl} currentLessFile
 * @param {Object} moduleInfo
 * @param {Array} moduleThemedStyles - набор темизируемых less
 * @returns {boolean}
 */
function checkLessForThemeInCache(currentLessFile, moduleInfo, moduleThemedStyles) {
   const
      prettyModuleDirectory = helpers.unixifyPath(path.dirname(moduleInfo.path)),
      prettyLessPath = helpers.unixifyPath(currentLessFile.history[0]),
      relativeLessPath = prettyLessPath.replace(`${prettyModuleDirectory}/`, '');

   return moduleThemedStyles.includes(transliterate(relativeLessPath));
}

/**
 * Объявление плагина
 * @param {TaskParameters} taskParameters параметры для задач
 * @param {ModuleInfo} moduleInfo информация о модуле
 * @param {string[]} pathsForImport пути, в которыи less будет искать импорты. нужно для работы межмодульных импортов.
 * @returns {stream}
 */
module.exports = function declarePlugin(taskParameters, moduleInfo, gulpModulesInfo) {
   const getOutput = function(file, replacingExt) {
      const relativePath = path.relative(moduleInfo.path, file.history[0]).replace(/\.less$/, replacingExt);
      return path.join(moduleInfo.output, transliterate(relativePath));
   };

   /**
    * Получаем полный набор темизируемых less в рамках одного Интерфейсного модуля по информации
    * о явных зависимостях компонента.
    * @returns {Array}
    */
   const getThemedStyles = function() {
      const
         componentsInfo = taskParameters.cache.getComponentsInfo(moduleInfo.name),
         result = [];

      Object.keys(componentsInfo).forEach((module) => {
         if (componentsInfo[module].hasOwnProperty('themedStyles')) {
            result.push(...componentsInfo[module].themedStyles);
         }
      });
      return result;
   };
   const moduleLess = [];
   const allThemes = taskParameters.cache.currentStore.styleThemes;
   let applicationRoot = '';

   /**
    * если приложение требует в пути до статики прописать resources, будем
    * прописывать. В противном случае будем работать с путями в линках прямо от корня.
    */
   if (taskParameters.config.resourcesUrl) {
      applicationRoot = '/resources/';
   }

   /**
    * Нам надо проверять через наличие /service/ в названии сервиса, так мы сможем
    * отличить служебный сервис от названия сервиса, по которому просится статика приложения
    */
   if (!taskParameters.config.urlServicePath.includes('/service')) {
      applicationRoot = helpers.unixifyPath(
         path.join(taskParameters.config.urlServicePath, applicationRoot)
      );
   }
   const applicationRootParams = {
      applicationRoot,
      isMultiService: taskParameters.config.multiService
   };
   return through.obj(

      /* @this Stream */
      function onTransform(file, encoding, callback) {
         try {
            let isLangCss = false;

            if (moduleInfo.contents.availableLanguage) {
               const avlLang = Object.keys(moduleInfo.contents.availableLanguage);
               isLangCss = avlLang.includes(file.basename.replace('.less', ''));
               file.isLangCss = isLangCss;
            }

            if (!file.path.endsWith('.less')) {
               callback(null, file);
               return;
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
         const moduleThemedStyles = getThemedStyles();
         await pMap(
            moduleLess,
            async(currentLessFile) => {
               try {
                  const isThemedLess = checkLessForThemeInCache(currentLessFile, moduleInfo, moduleThemedStyles);
                  const lessInfo = {
                     filePath: currentLessFile.history[0],
                     modulePath: moduleInfo.path,
                     text: currentLessFile.contents.toString(),
                     themes: taskParameters.config.themes
                  };
                  const [error, results] = await execInPool(
                     taskParameters.pool,
                     'buildLess',
                     [
                        lessInfo,
                        gulpModulesInfo,
                        currentLessFile.isLangCss || !isThemedLess,
                        allThemes,
                        applicationRootParams
                     ],
                     currentLessFile.history[0],
                     moduleInfo
                  );

                  /**
                   * нужно выводить ошибку из пулла, это будет означать неотловленную ошибку,
                   * и она не будет связана с ошибкой компиляции непосредственно less-файла.
                   */
                  if (error) {
                     taskParameters.cache.markFileAsFailed(currentLessFile.history[0]);
                     logger.error({
                        message: 'Необработанная ошибка builder\'а при компиляции less',
                        error,
                        moduleInfo,
                        filePath: currentLessFile.history[0]
                     });
                  } else {
                     for (const result of results) {
                        if (result.ignoreMessage) {
                           logger.debug(result.ignoreMessage);
                        } else if (result.error) {
                           /**
                            * результат с ключём 0 - это всегда less для старой
                            * схемы темизации. Для всех остальных ключей(1 и т.д.)
                            * задана новая схема темизации. Для новой схемы темизации
                            * выдаём warning, для старой темизации железно error.
                            */
                           const errorObject = {
                              message: `Ошибка компиляции less: ${result.error}`,
                              filePath: currentLessFile.history[0],
                              moduleInfo
                           };
                           if (!result.key) {
                              logger.error(errorObject);
                           } else {
                              logger.warning(errorObject);
                           }
                        } else {
                           const { compiled } = result;
                           const outputPath = getOutput(currentLessFile, compiled.defaultTheme ? '.css' : `_${compiled.nameTheme}.css`);

                           taskParameters.cache.addOutputFile(currentLessFile.history[0], outputPath, moduleInfo);
                           taskParameters.cache.addDependencies(currentLessFile.history[0], compiled.imports);

                           const newFile = currentLessFile.clone();
                           newFile.contents = Buffer.from(compiled.text);
                           newFile.path = outputPath;
                           newFile.base = moduleInfo.output;
                           this.push(newFile);

                           /**
                            * пишем в лог дополнительно информацию о получившихся импортах
                            * для каждой скомпиленной lessки.
                            */
                           const newInfoFile = currentLessFile.clone();
                           newInfoFile.contents = Buffer.from(compiled.importedByBuilder.toString());
                           newInfoFile.path = outputPath.replace(/\.css$/, '.txt');
                           newInfoFile.base = moduleInfo.output;
                           this.push(newInfoFile);
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
         callback(null);
      }
   );
};
