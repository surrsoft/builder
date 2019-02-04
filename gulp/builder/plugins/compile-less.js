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
   { buildLess } = require('../../../lib/build-less');

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
      isMultiService: taskParameters.config.multiService,
      resourcesUrl: taskParameters.config.resourcesUrl
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
         let moduleLessConfig = taskParameters.cache.getModuleLessConfiguration(moduleInfo.name);
         if (!moduleLessConfig) {
            moduleLessConfig = setDefaultLessConfiguration();
         }
         await pMap(
            moduleLess,
            async(currentLessFile) => {
               try {
                  const lessInfo = {
                     filePath: currentLessFile.history[0],
                     modulePath: moduleInfo.path,
                     text: currentLessFile.contents.toString(),
                     themes: taskParameters.config.themes,
                     moduleLessConfig
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
                     allThemes,
                     applicationRootParams
                  );
                  for (const result of results) {
                     if (result.ignoreMessage) {
                        logger.debug(result.ignoreMessage);
                     } else if (result.error) {
                        const errorObject = {
                           message: `Ошибка компиляции less: ${result.error}`,
                           filePath: currentLessFile.history[0],
                           moduleInfo
                        };
                        logger.error(errorObject);
                        taskParameters.cache.markFileAsFailed(currentLessFile.history[0]);
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
