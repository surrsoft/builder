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
require('../../lib/logger').setWorkerLogger();

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
   collectWordsPrimitive = require('../../lib/i18n/collect-words'),
   { wrapWorkerFunction } = require('./helpers');

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
 * @param {boolean} isMultiService является ли проект мультисервисным
 * @param {string} servicesPath путь к текущему сервису
 * @returns {Promise<string>}
 */
async function buildHtmlTmpl(
   text,
   fullPath,
   relativeFilePath,
   componentsPropertiesFilePath,
   isMultiService,
   servicesPath
) {
   return processingTmpl.buildHtmlTmpl(
      text,
      fullPath,
      relativeFilePath,
      await readComponentsProperties(componentsPropertiesFilePath),
      true,
      isMultiService,
      servicesPath
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

workerPool.worker({
   parseJsComponent: wrapWorkerFunction(parseJsComponent),
   parseRoutes: wrapWorkerFunction(processingRoutes.parseRoutes),
   buildLess: wrapWorkerFunction(buildLess),
   compileEsAndTs: wrapWorkerFunction(compileEsAndTs),
   buildTmpl: wrapWorkerFunction(buildTmpl),
   buildHtmlTmpl: wrapWorkerFunction(buildHtmlTmpl),
   prepareXHTML: wrapWorkerFunction(prepareXHTML),
   buildXhtml: wrapWorkerFunction(buildXhtml),
   minifyCss: wrapWorkerFunction(runMinifyCss),
   minifyXhtmlAndHtml: wrapWorkerFunction(runMinifyXhtmlAndHtml),
   uglifyJs: wrapWorkerFunction(uglifyJs),
   collectWords: wrapWorkerFunction(collectWords)
});
