'use strict';
const
   path = require('path'),
   fs = require('fs'),
   traverse = require('estraverse').traverse,
   transliterate = require('../lib/transliterate'),
   logger = require('../lib/logger').logger();


const dblSlashes = /\\/g;

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

const cache = {};

function loadFileToCache(filePath) {
   filePath = path.normalize(filePath);
   return new Promise((resolve, reject) => {
      if (cache.hasOwnProperty(filePath)) {
         logger.info('CACHE: ' + filePath);//TODO:убрать
         resolve(cache[filePath]);
      } else {
         fs.readFile(filePath, (err, text) => {
            if (err) {
               reject(err);
            } else {
               logger.info('READ FILE: ' + filePath);//TODO:убрать
               cache[filePath] = text.toString();
               resolve(cache[filePath]);
            }
         });
      }
   });
}

function getFileFromCache(filePath) {
   return cache[path.normalize(filePath)];
}

async function replaceIncludes(text, opts, config, forPresentationService) {
   try {
      const replaceIncludes = new Map(),
         promisesLoadFiles = [];


      let result = INCLUDE.exec(text);
      while (result) {
         const file = path.join(config.root, config.application, 'resources', transliterate(result[1]));
         promisesLoadFiles.push(loadFileToCache(file));
         replaceIncludes.set(result[0], file);
         result = INCLUDE.exec(text);
      }
      await Promise.all(promisesLoadFiles);
      replaceIncludes.forEach((value, key)=>{
         text = text.replace(key, getFileFromCache(value));
      });

      /*
            const filesPaths = text.match(INCLUDE);
            if (filesPaths) {
               await Promise.all(filesPaths.map((original, include) => {
                  return loadFileToCache(file);
               }));

               while (INCLUDE.test(text)) {
                  text = text.replace(INCLUDE, function(original, include) {
                     try {
                        const file = path.join(config.root, config.application, 'resources', transliterate(include));
                        return getFileFromCache(file);
                     } catch (err) {
                        logger.error({
                           error: err
                        });
                        return original;
                     }
                  });
               }
            }*/

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

      text = text.replace(WINDOW_TITLE, opts['title'] || '');
      text = text.replace(APPEND_STYLE, '');
      text = text.replace(APPEND_JAVASCRIPT, '');
      text = text.replace(ACCESS_LIST, '');
      text = text.replace(SAVE_LAST_STATE, false);
      text = text.replace(START_DIALOG, opts['moduleName']);

   } catch (err) {
      logger.error({
         error: err
      });
   }
   return text;
}

function findExpression(node, left) {
   //
   return node.type === 'ExpressionStatement' && node.expression && node.expression.type === 'AssignmentExpression' &&
      node.expression.operator === '=' && node.expression.left.type === 'MemberExpression' &&
      node.expression.left.property.name === left && node.expression.left.object &&
      node.expression.left.object.type === 'Identifier';
}

function parseObjectExpression(properties) {
   let obj = {};
   properties.forEach(function(prop) {
      obj[prop.key.name] = prop.value.value;
   });
   return obj;
}


function generateHtml(contents, opts, config, forPresentationService) {
   return new Promise(async(resolve, reject) => {
      const
         moduleName = opts['moduleName'],
         webPage = opts['webPage'] || {};
      let
         outFileName = webPage['outFileName'];
      let htmlTemplate = webPage['htmlTemplate'] || '';

      if (!outFileName) {
         reject(new Error('Не указан outFileName для webPage'));
      } else if (!htmlTemplate) {
         logger.debug(`Using default template for output file ${outFileName}.html`);
      }

      contents.htmlNames[moduleName] = config.application.replace('/', '') + outFileName + '.html';

      htmlTemplate = transliterate(htmlTemplate.replace(dblSlashes, '/'));

      outFileName += '.html';

      let templatePath = '';
      if (!htmlTemplate) {
         templatePath = path.join(__dirname, './../resources/index.html');
         logger.debug(`Шаблон не указан, используем ${templatePath}`);
      } else {
         templatePath = path.join(config.applicationRoot, 'resources', htmlTemplate);
      }

      try {
         const result = await loadFileToCache(templatePath);
         resolve({
            outputPath: path.join(config.applicationRoot, outFileName),
            text: await replaceIncludes(result, opts, config, forPresentationService)
         });
      } catch (error) {
         reject(error);
      }
   });
}

function generateStaticHtmlForJs(ast, contents, config, forPresentationService) {
   return new Promise(function(resolve, reject) {
      if (!contents.hasOwnProperty()) {
         contents.htmlNames = {};
      }

      const arrExpr = [];
      let ReturnStatement = null,
         moduleName = '';

      traverse(ast, {
         enter: function getModuleName(node) {
            if (findExpression(node, 'webPage') && node.expression.right && node.expression.right.type === 'ObjectExpression') {
               arrExpr.push(node.expression);
            }

            if (findExpression(node, 'title') && node.expression.right && node.expression.right.type === 'Literal') {
               arrExpr.push(node.expression);
            }

            if (node.type === 'CallExpression' && node.callee.type === 'Identifier' &&
               node.callee.name === 'define') {
               if (node['arguments'][0].type === 'Literal' && typeof node['arguments'][0].value === 'string') {
                  moduleName = node['arguments'][0].value;
               }

               let fnNode = null;
               if (node['arguments'][1] && node['arguments'][1].type === 'FunctionExpression') {
                  fnNode = node['arguments'][1].body;
               } else if (node['arguments'][2] && node['arguments'][2].type === 'FunctionExpression') {
                  fnNode = node['arguments'][2].body;
               }
               if (fnNode) {
                  if (fnNode.body && fnNode.body instanceof Array) {
                     fnNode.body.forEach(function(i) {
                        if (i.type === 'ReturnStatement') {
                           ReturnStatement = i.argument;
                        }
                     });
                  }
               }
            }
         }
      });

      if (arrExpr.length && ReturnStatement) {
         const opts = {};

         arrExpr.forEach(function(expr) {
            try {
               if (expr.left.object.name === ReturnStatement.name) {
                  if (expr.right.type === 'ObjectExpression') {
                     opts[expr.left.property.name] = parseObjectExpression(expr.right.properties);
                  } else {
                     opts[expr.left.property.name] = expr.right.value;
                  }

               }

            } catch (error) {
               reject(error);
            }
         });

         if (Object.keys(opts).length === 0) {
            //ничего не нашли, выходим.
            resolve();
            return;
         }
         opts.moduleName = moduleName;
         generateHtml(contents, opts, config, forPresentationService)
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
