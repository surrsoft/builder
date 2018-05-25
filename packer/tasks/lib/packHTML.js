/* eslint-disable max-nested-callbacks */
'use strict';

const path = require('path');
const fs = require('fs-extra');
const async = require('async');
const esprima = require('esprima');
const traverse = require('estraverse').traverse;

const logger = require('../../../lib/logger').logger();

const domHelpers = require('./../../lib/domHelpers');
const commonPackage = require('./../../lib/commonPackage');

/**
 * @callback packInOrder~callback
 * @param {Error} error
 * @param {{js: string, css: string, dict: Object, cssForLocale: Object}} [result]
 */
/**
 * Формирует объект с пакетами js, css и объект dict с пакетом для каждой локали
 * @param {DepGraph} dg - граф зависимостей
 * @param {Array} modArray - массив вершин
 * @param {String} root - корень сервиса
 * @param {String} applicationRoot - корень сервиса
 * @param {packInOrder~callback} done - callback
 * @param {String} themeName - имя темы
 * @param {String} staticHtmlName - имя статической html странички
 */
function packInOrder(dg, modArray, root, applicationRoot, themeName, staticHtmlName, done) {
   let orderQueue;

   orderQueue = dg.getLoadOrder(modArray);
   orderQueue = commonPackage.prepareOrderQueue(dg, orderQueue, applicationRoot);
   orderQueue = commonPackage.prepareResultQueue(orderQueue, applicationRoot);

   commonPackage.getJsAndCssPackage(orderQueue, root, themeName, staticHtmlName, done);
}

function insertAllDependenciesToDocument(filesToPack, type, insertAfter) {
   const type2attr = {
      'js': 'src',
      'css': 'href'
   };
   const type2node = {
      'js': 'script',
      'css': 'link'
   };
   const type2type = {
      'js': 'text/javascript',
      'css': 'text/css'
   };
   const options = {
      'data-pack-name': `ws-mods-${type}`,
      'type': type2type[type]
   };

   if (insertAfter && filesToPack && filesToPack[type]) {
      filesToPack = filesToPack[type];

      if (filesToPack.length && type in type2attr) {
         if (type === 'css') {
            options.rel = 'stylesheet';
         }
         let newTarget = domHelpers.mkCommentNode(insertAfter.ownerDocument, '[/packedScripts]');
         insertAfter.parentNode.insertBefore(newTarget, insertAfter.nextSibling);
         filesToPack.reverse().filter(file => file.name).forEach((file) => {
            options['data-pack-name'] = file.skip ? 'skip' : `ws-mods-${type}`;

            options[type2attr[type]] = file.name.replace(/\\/g, '/');
            newTarget = domHelpers.mkDomNode(insertAfter.ownerDocument, type2node[type], options);
            insertAfter.parentNode.insertBefore(newTarget, insertAfter.nextSibling);
         });
         newTarget = domHelpers.mkCommentNode(insertAfter.ownerDocument, '[packedScripts]');
         insertAfter.parentNode.insertBefore(newTarget, insertAfter.nextSibling);
      }
   }
}

function generatePackage(extWithoutVersion, grunt, filesToPack, ext, packageTarget, applicationRoot, siteRoot, namePrefix) {
   if (namePrefix === undefined) {
      namePrefix = '';
   }

   if (filesToPack) {
      if (typeof filesToPack === 'string') {
         filesToPack = [filesToPack];
      }

      return filesToPack.map((file) => {
         const
            urlServicePath = grunt.option('url-service-path') ? path.join(siteRoot, grunt.option('url-service-path')) : applicationRoot,
            packageName = namePrefix + domHelpers.uniqname(file, ext),
            packedFileName = path.join(packageTarget, packageName);

         // Даннный флаг определяет надо вставить в статическую страничку путь до пакета с констркуией %{RESOURCE_ROOT} или абсолютный путь.
         // false - если у нас разделённое ядро и несколько сервисов.
         // true - если у нас монолитное ядро или один сервис.
         const replacePath = !(grunt.option('splitted-core') && grunt.option('multi-service'));
         let packedFilePath = path.normalize(path.join(applicationRoot, packedFileName));

         grunt.file.write(packedFilePath.replace(ext, extWithoutVersion), file);

         packedFilePath = path.normalize(path.join(urlServicePath, packedFileName));

         if (replacePath) {
            return { 'name': `/${path.relative(siteRoot, packedFilePath)}`, 'skip': !!namePrefix };
         }
         return {
            'name': `%{RESOURCE_ROOT}${packedFileName.replace(/resources(?:\/|\\)/, '')}`,
            'skip': !!namePrefix
         };
      });
   }
   return {};
}

function getStartNodes(grunt, divs) {
   let startNodes = [],
      div, tmplName;

   for (let i = 0, l = divs.length; i < l; i++) {
      div = divs[i];
      const divClass = div.getAttribute('class');
      if (divClass && divClass.indexOf('ws-root-template') > -1 && (tmplName = div.getAttribute('data-template-name'))) {
         logger.debug(`Packing inner template '${tmplName}'`);

         if (!tmplName.includes('!')) {
            startNodes = [...startNodes, tmplName];
         }
      }

      if (tmplName) {
         if (startNodes.length === 0) {
            logger.debug(`No any dependencies collected for '${tmplName}'`);
         } else {
            logger.debug(`Got ${startNodes.length} start nodes for '${tmplName}': ${startNodes.join(',')}`);
         }
      }
   }

   // сделаем список стартовых вершни уникальным
   startNodes = startNodes.filter((el, idx, arr) => arr.indexOf(el, idx + 1) === -1);

   return startNodes;
}

/**
 * Возвращает универсальный ключ, учитывая возможность наличия версии билда дистра
 * @param buildNumber
 * @param key
 */
function getKey(buildNumber, key) {
   return buildNumber ? `v${buildNumber}.${key}` : key;
}

/**
 * Достаём тему из wsConfig и если она задана, значит паковать
 * надо с учётом этой темы
 */
function getThemeFromWsConfig(wsConfig) {
   const ast = esprima.parse(wsConfig.firstChild.data);
   let themeName = null;

   traverse(ast, {
      enter(node) {
         if (node.type === 'AssignmentExpression' && node.operator === '=') {
            if (node.right && node.right.type === 'ObjectExpression' && node.right.properties) {
               node.right.properties.forEach((option) => {
                  if (option.key.name === 'themeName') {
                     themeName = option.value.value;
                  }
               });
            }
         }
      }
   });
   return themeName;
}

function packHTML(grunt, dg, htmlFileset, packageHome, root, application, taskDone) {
   logger.debug(`Packing dependencies of ${htmlFileset.length} files...`);
   const
      buildNumber = grunt.option('versionize');

   async.eachLimit(htmlFileset, 1, (htmlFile, done) => {
      try {
         logger.debug(htmlFile);

         const dom = domHelpers.domify(fs.readFileSync(htmlFile, 'utf-8')),
            divs = dom.getElementsByTagName('div'),
            jsTarget = dom.getElementById('ws-include-components'),
            cssTarget = dom.getElementById('ws-include-css'),
            htmlPath = htmlFile.split(path.sep),
            htmlName = htmlPath[htmlPath.length - 1],
            wsConfig = dom.getElementById('ws-config'),
            applicationRoot = path.join(root, application);

         let themeName;

         if (wsConfig) {
            themeName = getThemeFromWsConfig(wsConfig);
         }

         if (jsTarget || cssTarget) {
            const startNodes = getStartNodes(grunt, divs, application);

            packInOrder(dg, startNodes, root, path.join(root, application), themeName, htmlName, (err, filesToPack) => {
               if (err) {
                  logger.debug(err); // Имееет ли смысл?
                  done(err);
               } else {
                  // Запишем в статическую html зависимости от ВСЕХ пакетов(основные js и css пакеты + пакеты для каждой локали).

                  // filesToPack = {"css": [], "js": "...", "dict": {"en-US": "", "ru-RU": ""}, "cssForLocale": {"en-US": []}};
                  const attr2ext = { 'cssForLocale': 'css', 'dict': 'js' },
                     packages = { 'css': [], 'js': [] };

                  Object.keys(filesToPack).forEach((key) => {
                     if (filesToPack[key] !== null && typeof filesToPack[key] === 'object') {
                        if (Array.isArray(filesToPack[key])) { // "css": []
                           filesToPack[key].map((content) => {
                              packages[key] = packages[key].concat(generatePackage(key, grunt, content, getKey(buildNumber, key), packageHome, applicationRoot, root));
                           });
                        } else { // "dict": {"en-US": "", "ru-RU": ""}, "cssForLocale": {"en-US": []} lkz
                           // пакеты для локалей запакуем с data-pack = "skip" чтобы потом на ПП вырезать ненужные из html
                           Object.keys(filesToPack[key]).forEach((locale) => {
                              packages[attr2ext[key]] = packages[attr2ext[key]].concat(generatePackage(attr2ext[key], grunt, filesToPack[key][locale], getKey(buildNumber, attr2ext[key]), packageHome, applicationRoot, root, locale));
                           });
                        }
                     } else { // "js": "..."
                        const generatedScript = generatePackage(key, grunt, filesToPack[key], getKey(buildNumber, key), packageHome, applicationRoot, root);
                        packages[key] = packages[key].concat(generatedScript);
                     }
                  });

                  // пропишем в HTML
                  insertAllDependenciesToDocument(packages, 'js', jsTarget);
                  insertAllDependenciesToDocument(packages, 'css', cssTarget);

                  grunt.file.write(htmlFile, domHelpers.stringify(dom));
                  done();
               }
            });
         } else {
            logger.debug(`No any packing target in '${htmlFile}'`);
            done();
         }
      } catch (err) {
         if (typeof err === 'string') {
            err = new Error(err);
         }
         logger.warning({
            message: 'ERROR! Failed to process HTML',
            filePath: htmlFile,
            error: err
         });
         done(err);
      }
   }, (err) => {
      if (err) {
         taskDone(err);
      } else {
         taskDone();
      }
   });
}

module.exports = packHTML;
