'use strict';
const
   path = require('path'),
   fs = require('fs'),
   transliterate = require('../lib/transliterate'),
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

//кеш для хранения прочитанных файлов
const cache = {};

const dblSlashes = /\\/g;

function loadFileToCache(filePath, resources) {
   filePath = path.normalize(filePath);
   return new Promise((resolve, reject) => {
      if (cache.hasOwnProperty(filePath)) {
         resolve(cache[filePath]);
      } else {
         fs.readFile(filePath, async(err, text) => {
            if (err) {
               reject(err);
            } else {
               cache[filePath] = await replaceIncludes(text.toString(), resources);
               resolve(cache[filePath]);
            }
         });
      }
   });
}

function getFileFromCache(filePath) {
   return cache[path.normalize(filePath)];
}

async function replaceIncludes(text, resources) {
   const replaceMapIncludes = new Map(),
      promisesLoadFiles = [];
   let result = INCLUDE.exec(text);
   while (result) {
      const file = path.join(resources, transliterate(result[1]));
      promisesLoadFiles.push(loadFileToCache(file, resources));
      replaceMapIncludes.set(result[0], file);
      result = INCLUDE.exec(text);
   }
   await Promise.all(promisesLoadFiles);
   replaceMapIncludes.forEach((value, key) => {
      text = text.replace(key, getFileFromCache(value));
   });
   return text;
}

async function replaceConstant(text, componentInfo, config, forPresentationService) {
   try {
      text = await replaceIncludes(text, path.join(config.root, config.application, 'resources'));
      if (!forPresentationService) {
         //сервис представлений сам установит эти переменные.
         //нужно подставлять переменные если:
         // -используется препроцессор
         // -не используется ни препроцессор, ни сервис представлений
         text = text.replace(APPLICATION_ROOT, config.application);
         text = text.replace(SBIS_ROOT, config.application + 'ws/');
         text = text.replace(RESOURCE_ROOT, config.application + 'resources/');
         text = text.replace(SERVICES_PATH, config.servicesPath || config.application + 'service/');
         text = text.replace(USER_PARAMS, config.userParams);
         text = text.replace(GLOBAL_PARAMS, config.globalParams);
      }

      text = text.replace(WINDOW_TITLE, componentInfo.webPage.title || '');
      text = text.replace(APPEND_STYLE, '');
      text = text.replace(APPEND_JAVASCRIPT, '');
      text = text.replace(ACCESS_LIST, '');
      text = text.replace(SAVE_LAST_STATE, false);
      text = text.replace(START_DIALOG, componentInfo.moduleName);

   } catch (err) {
      logger.error({
         error: err
      });
   }
   return text;
}

function generateHtml(contents, componentInfo, config, forPresentationService) {
   return new Promise(async(resolve, reject) => {
      try {
         const moduleName = componentInfo['moduleName'],
            webPage = componentInfo['webPage'];
         let outFileName = webPage['outFileName'];
         let htmlTemplate = webPage['htmlTemplate'] || '';

         if (!moduleName) {
            return reject(new Error('Не указано имя компонента'));
         }
         if (!htmlTemplate) {
            logger.debug(`Using default template for output file ${outFileName}.html`);
         }

         contents.htmlNames[moduleName] = config.application.replace('/', '') + outFileName + '.html';

         htmlTemplate = transliterate(htmlTemplate.replace(dblSlashes, '/'));

         outFileName += '.html';

         let templatePath = '';
         if (!htmlTemplate) {
            templatePath = path.join(__dirname, './../resources/index.html');
            logger.warning(`Шаблон не указан, используем ${templatePath}`);
         } else {
            templatePath = path.join(config.applicationRoot, 'resources', htmlTemplate);
         }


         const result = await loadFileToCache(templatePath, path.join(config.applicationRoot, 'resources'));
         resolve({
            outputPath: path.join(config.applicationRoot, outFileName),
            text: await replaceConstant(result, componentInfo, config, forPresentationService)
         });
      } catch (error) {
         reject(error);
      }
   });
}

function generateStaticHtmlForJs(componentInfo, contents, config, forPresentationService) {
   return new Promise(function(resolve, reject) {
      if (componentInfo.hasOwnProperty('webPage') && componentInfo.webPage.hasOwnProperty('outFileName') &&
         componentInfo.webPage.outFileName && componentInfo.webPage.outFileName.trim()) {

         if (!contents.hasOwnProperty('htmlNames')) {
            contents.htmlNames = {};
         }

         generateHtml(contents, componentInfo, config, forPresentationService)
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
