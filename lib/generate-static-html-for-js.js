'use strict';
const
   path = require('path'),
   fs = require('fs'),
   logger = require('../lib/logger').logger();


//регулярки для замены в статических html
const
   INCLUDE = /%{INCLUDE\s(?:["'])([^'"]*)(?:["'])\s?}/g,
   WINDOW_TITLE = /%{WINDOW_TITLE}/g,
   APPEND_STYLE = /%{APPEND_STYLE}/g,
   APPEND_JAVASCRIPT = /%{APPEND_JAVASCRIPT}/g,
   ACCESS_LIST = /%{ACCESS_LIST}/g,
   APPLICATION_ROOT = /%{APPLICATION_ROOT}/g,
   SBIS_ROOT = /%{WI\.SBIS_ROOT}/g,
   RESOURCE_ROOT = /%{RESOURCE_ROOT}/g,
   SERVICES_PATH = /%{SERVICES_PATH}/g,
   USER_PARAMS = /%{CONFIG\.USER_PARAMS}/g,
   GLOBAL_PARAMS = /%{CONFIG\.GLOBAL_PARAMS}/g,
   SAVE_LAST_STATE = /%{SAVE_LAST_STATE}/g,
   START_DIALOG = /%{START_DIALOG(.*)}/g;

const dblSlashes = /\\/g;

//кеш для хранения обработанных html-шаблонов с развёрнутыми includes
const cache = {};

//рекурсивный и ассинхронный обход html-шаблонов.
//результат с развёрнутыми INCLUDE положим в cache
function loadFileAndReplaceIncludes(filePath, modules) {
   filePath = path.normalize(filePath);
   return new Promise((resolve, reject) => {
      if (cache.hasOwnProperty(filePath)) {
         resolve(cache[filePath]);
      } else {
         fs.readFile(filePath, async(err, text) => {
            if (err) {
               reject(err);
            } else {
               try {
                  cache[filePath] = await replaceIncludes(text.toString(), modules);
                  resolve(cache[filePath]);
               } catch (error) {
                  error.message = `Ошибка при обработке файла ${filePath}: ${error.message}`;
                  reject(error);
               }
            }
         });
      }
   });
}

function findFileInModules(relativePath, modules) {
   const parts = relativePath.replace(dblSlashes, '/').split('/');

   // в пути должно быть минимум два элемента: имя папки модуля и имя файла.
   if (parts.length < 2) {
      return relativePath;
   }
   const moduleName = parts[0] || parts[1]; //если путь начинается со слеша, то первый элемент - пустая строка
   if (modules.has(moduleName)) {
      return path.join(path.dirname(modules.get(moduleName)), relativePath);
   } else {
      throw new Error(`Не удалось найти модуль '${moduleName}' в проекте`);
   }
}

async function replaceIncludes(text, modules) {
   const replaceMapIncludes = new Map(),
      promisesLoadFiles = [];
   let result = INCLUDE.exec(text);
   while (result) {
      const file = findFileInModules(result[1], modules);
      promisesLoadFiles.push(loadFileAndReplaceIncludes(file, modules));
      replaceMapIncludes.set(result[0], file);
      result = INCLUDE.exec(text);
   }

   //ждём пока все используемые html шаблоны попадут в cache
   await Promise.all(promisesLoadFiles);

   replaceMapIncludes.forEach((value, key) => {
      text = text.replace(key, cache[path.normalize(value)]);
   });
   return text;
}

function replaceConstant(text, componentInfo, config, forPresentationService) {
   try {
      if (!forPresentationService) {
         //сервис представлений сам установит эти переменные.
         //нужно подставлять переменные если:
         // -используется препроцессор
         // -не используется ни препроцессор, ни сервис представлений
         text = text.replace(APPLICATION_ROOT, config.application);
         text = text.replace(SBIS_ROOT, config.application + 'ws/');
         text = text.replace(RESOURCE_ROOT, config.application + 'resources/');
         text = text.replace(SERVICES_PATH, config.servicesPath || config.application + 'service/');
         text = text.replace(USER_PARAMS, config.userParams || false);
         text = text.replace(GLOBAL_PARAMS, config.globalParams || false);
      }

      text = text.replace(WINDOW_TITLE, componentInfo.webPage.title || '');
      text = text.replace(APPEND_STYLE, '');
      text = text.replace(APPEND_JAVASCRIPT, '');
      text = text.replace(ACCESS_LIST, '');
      text = text.replace(SAVE_LAST_STATE, false);
      text = text.replace(START_DIALOG, componentInfo.componentName);

   } catch (err) {
      logger.error({
         error: err
      });
   }
   return text;
}

function generateHtml(file, contents, componentInfo, config, modules, forPresentationService) {
   return new Promise(async(resolve, reject) => {
      try {
         const componentName = componentInfo['componentName'];
         const webPage = componentInfo['webPage'];
         const htmlTemplate = (webPage['htmlTemplate'] || '').replace(dblSlashes, '/');
         const outFileName = webPage['outFileName'] + '.html';

         if (!componentName) {
            return reject(new Error('Не указано имя компонента'));
         }
         if (!htmlTemplate) {
            logger.debug(`Using default template for output file ${outFileName}`);
         }

         let templatePath = '';
         if (!htmlTemplate) {
            templatePath = path.join(__dirname, './../resources/index.html');
            logger.warning({
               message: `Шаблон не указан, используем ${templatePath}`,
               filePath: file
            });
         } else {
            templatePath = findFileInModules(htmlTemplate, modules);
         }

         const text = await loadFileAndReplaceIncludes(templatePath, modules);
         const result = {
            outFileName: outFileName,
            text: replaceConstant(text, componentInfo, config, forPresentationService)
         };

         // запись в htmlNames делаем после всех замен.
         // иначе если возникнет исключение при заменах, свалится потом splitResources.
         contents.htmlNames[componentName] = outFileName;
         resolve(result);
      } catch (error) {
         reject(error);
      }
   });
}

function generateStaticHtmlForJs(file, componentInfo, contents, config, modules, forPresentationService) {
   return new Promise(function(resolve, reject) {
      if (componentInfo.hasOwnProperty('webPage') && componentInfo.webPage.hasOwnProperty('outFileName') &&
         componentInfo.webPage.outFileName && componentInfo.webPage.outFileName.trim()) {

         if (!contents.hasOwnProperty('htmlNames')) {
            contents.htmlNames = {};
         }

         generateHtml(file, contents, componentInfo, config, modules, forPresentationService)
            .then(
               result => {
                  resolve(result);
               },
               error => {
                  reject(error);
               }
            );
      } else {
         resolve();
      }
   });
}

module.exports = generateStaticHtmlForJs;
