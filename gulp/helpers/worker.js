'use strict';

// логгер - прежде всего
const logger = require('../../lib/logger').setWorkerLogger();

// ws должен быть вызван раньше чем первый global.requirejs
const nodeWS = require('../helpers/node-ws');
nodeWS.init();

const fs = require('fs-extra'),
   workerPool = require('workerpool'),
   helpers = require('../../lib/helpers'),
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

async function buildTmpl(text, relativeFilePath, componentsPropertiesFilePath) {
   return processingTmpl.buildTmpl(
      processingTmpl.minifyTmpl(text),
      relativeFilePath,
      await readComponentsProperties(componentsPropertiesFilePath)
   );
}

async function buildHtmlTmpl(text, fullPath, relativeFilePath, componentsPropertiesFilePath) {
   return processingTmpl.buildHtmlTmpl(
      text,
      fullPath,
      relativeFilePath,
      await readComponentsProperties(componentsPropertiesFilePath)
   );
}

async function prepareXHTML(text, componentsPropertiesFilePath) {
   return prepareXHTMLPrimitive(text, await readComponentsProperties(componentsPropertiesFilePath));
}

async function buildXhtml(text) {
   return buildXhtmlPrimitive(await runMinifyXhtmlAndHtml(text));
}
async function collectWords(modulePath, filePath, componentsPropertiesFilePath) {
   if (!componentsProperties) {
      componentsProperties = await fs.readJSON(componentsPropertiesFilePath);
   }
   const text = await fs.readFile(filePath);
   return collectWordsPrimitive(modulePath, filePath, text.toString(), componentsProperties);
}

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
   buildTmpl: wrapFunction(buildTmpl),
   buildHtmlTmpl: wrapFunction(buildHtmlTmpl),
   prepareXHTML: wrapFunction(prepareXHTML),
   buildXhtml: wrapFunction(buildXhtml),
   minifyCss: wrapFunction(runMinifyCss),
   minifyXhtmlAndHtml: wrapFunction(runMinifyXhtmlAndHtml),
   uglifyJs: wrapFunction(uglifyJs),
   gzip: wrapFunction(helpers.gzip),
   collectWords: wrapFunction(collectWords)
});
