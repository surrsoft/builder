/**
 * Воркер для пула воркеров. Используется для сборки статики и сбора локализуемых фраз.
 * @author Бегунов Ал. В.
 */

'use strict';

// не всегда понятно по 10 записям, откуда пришёл вызов.
Error.stackTraceLimit = 100;

process.on('unhandledRejection', (reason, p) => {
   // eslint-disable-next-line no-console
   console.log(
      "[00:00:00] [ERROR] Критическая ошибка в работе worker'а. ",
      'Unhandled Rejection at:\n',
      p,
      '\nreason:\n',
      reason
   );
   process.exit(1);
});

// логгер - прежде всего
const logger = require('../../lib/logger').setWorkerLogger();

// ws должен быть вызван раньше чем первый global.requirejs
const nodeWS = require('./node-ws');
nodeWS.init();

const fs = require('fs-extra'),
   workerPool = require('workerpool'),
   compileEsAndTs = require('../../lib/compile-es-and-ts'),
   buildLess = require('../../lib/build-less'),
   processingTmpl = require('../../lib/processing-tmpl'),
   parseJsComponent = require('../../lib/parse-js-component'),
   processingRoutes = require('../../lib/processing-routes'),
   prepareXHTMLPrimitive = require('../../lib/i18n/prepare-xhtml'),
   buildXhtmlPrimitive = require('../../lib/processing-xhtml').buildXhtml,
   runMinifyCss = require('../../lib/run-minify-css'),
   runMinifyXhtmlAndHtml = require('../../lib/run-minify-xhtml-and-html'),
   uglifyJs = require('../../lib/run-uglify-js'),
   collectWordsPrimitive = require('../../lib/i18n/collect-words');

let componentsProperties;

/**
 * Прочитать описание компонетов из json для локализации. Или взять прочитанное ранее.
 * @param {string} componentsPropertiesFilePath путь до json-файла описания компонентов
 * @returns {Promise<Object>}
 */
async function readComponentsProperties(componentsPropertiesFilePath) {
   if (!componentsProperties) {
      if (await fs.pathExists(componentsPropertiesFilePath)) {
         componentsProperties = await fs.readJSON(componentsPropertiesFilePath);
      } else {
         componentsProperties = {};
      }
   }
   return componentsProperties;
}

/**
 * Компиляция tmpl файлов
 * @param {string} text содержимое файла
 * @param {string} relativeFilePath относительный путь до файла (начинается с имени модуля)
 * @param {string} componentsPropertiesFilePath путь до json-файла описания компонентов
 * @returns {Promise<{text, nodeName, dependencies}>}
 */
async function buildTmpl(text, relativeFilePath, componentsPropertiesFilePath) {
   return processingTmpl.buildTmpl(
      processingTmpl.minifyTmpl(text),
      relativeFilePath,
      await readComponentsProperties(componentsPropertiesFilePath)
   );
}

/**
 * Компиляция html.tmpl файлов
 * @param {string} text содержимое файла
 * @param {string} fullPath полный путь до файла
 * @param {string} relativeFilePath относительный путь до файла (начинается с имени модуля)
 * @param {string} componentsPropertiesFilePath путь до json-файла описания компонентов
 * @param {boolean} replacePath нужно ли вставлять путь к сервису в получившемся html
 * @param {string} urlServicePath относительный url текущего сервиса
 * @returns {Promise<string>}
 */
async function buildHtmlTmpl(
   text,
   fullPath,
   relativeFilePath,
   componentsPropertiesFilePath,
   replacePath,
   urlServicePath
) {
   return processingTmpl.buildHtmlTmpl(
      text,
      fullPath,
      relativeFilePath,
      await readComponentsProperties(componentsPropertiesFilePath),
      true,
      replacePath,
      urlServicePath
   );
}

/**
 * Для xhtml В XML формате расставляются скобки {[]} - аналог rk - для локализцемых фраз
 * (строки в разметке и переводимые опции).
 * @param {string} text содержимое файла
 * @param {string} componentsPropertiesFilePath путь до json-файла описания компонентов
 * @returns {Promise<String>}
 */
async function prepareXHTML(text, componentsPropertiesFilePath) {
   return prepareXHTMLPrimitive(text, await readComponentsProperties(componentsPropertiesFilePath));
}

/**
 * Компиляция xhtml в js
 * @param {string} text содержимое файла
 * @param {string} relativeFilePath относительный путь до файла (начинается с имени модуля)
 * @returns {Promise<{nodeName, text}>}
 */
async function buildXhtml(text, relativeFilePath) {
   return buildXhtmlPrimitive(await runMinifyXhtmlAndHtml(text), relativeFilePath);
}

/**
 * Сбор локализуемых фрах для конкретного файла
 * @param {string} modulePath путь до модуля
 * @param {string} filePath путь до файла
 * @param {string} componentsPropertiesFilePath путь до json-файла описания компонентов
 * @returns {Promise<string[]>}
 */
async function collectWords(modulePath, filePath, componentsPropertiesFilePath) {
   if (!componentsProperties) {
      componentsProperties = await fs.readJSON(componentsPropertiesFilePath);
   }
   const text = await fs.readFile(filePath);
   return collectWordsPrimitive(modulePath, filePath, text.toString(), componentsProperties);
}

/**
 * Оборачивает функцию, чтобы была возможность вернуть ошибки и варнинги от WS.
 * Работает в тандеме с gulp/helpers/exec-in-pool.js
 * @param {Function} func функция, которую оборачиваем
 * @returns {Function}
 */
function wrapFunction(func) {
   return async(funcArgs, filePath = null, moduleInfo = null) => {
      logger.setInfo(filePath, moduleInfo);
      let result;
      try {
         result = func(...funcArgs);
         if (result instanceof Promise) {
            result = await result;
         }
      } catch (error) {
         return [{ message: error.message, stack: error.stack }, null, logger.getMessageForReport()];
      }
      return [null, result, logger.getMessageForReport()];
   };
}
workerPool.worker({
   parseJsComponent: wrapFunction(parseJsComponent),
   parseRoutes: wrapFunction(processingRoutes.parseRoutes),
   buildLess: wrapFunction(buildLess),
   compileEsAndTs: wrapFunction(compileEsAndTs),
   buildTmpl: wrapFunction(buildTmpl),
   buildHtmlTmpl: wrapFunction(buildHtmlTmpl),
   prepareXHTML: wrapFunction(prepareXHTML),
   buildXhtml: wrapFunction(buildXhtml),
   minifyCss: wrapFunction(runMinifyCss),
   minifyXhtmlAndHtml: wrapFunction(runMinifyXhtmlAndHtml),
   uglifyJs: wrapFunction(uglifyJs),
   collectWords: wrapFunction(collectWords)
});
