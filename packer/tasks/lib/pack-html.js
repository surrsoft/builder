'use strict';

const path = require('path');
const fs = require('fs-extra');
const esprima = require('esprima');
const { traverse } = require('estraverse');
const pMap = require('p-map');
const cssHelpers = require('../../lib/css-helpers');

const logger = require('../../../lib/logger').logger();

const domHelpers = require('../../lib/dom-helpers');
const helpers = require('../../../lib/helpers');
const commonPackage = require('../../lib/common-package');

// TODO: костыль: список статических html страниц для которых не пакуем стили контролов
const HTMLPAGESWITHNOONLINESTYLES = [
   'carry.html',
   'presto.html',
   'carry_minimal.html',
   'booking.html',
   'plugin.html',
   'hint.html',
   'CryptoAppWindow.html'
];

// TODO: Костыль: Узнаем по наличию модуля (s3mod) в оффлайне мы или нет

const offlineModuleName = 'Retail_Offline';

async function checkItIsOfflineClient(applicationRoot) {
   const offlineClientModulePath = path.join(applicationRoot, `resources/${offlineModuleName}/`);
   try {
      return await fs.pathExists(offlineClientModulePath);
   } catch (err) {
      return false;
   }
}

/**
 * Просто собирает указанные файлы в один большой кусок текста
 * @param {Array} filesToPack - модули для паковки
 * @param {String} base - полный путь до папки с пакетами
 * @param themeName
 * Относительно этой папки будут высчитаны новые пути в ссылках
 */
async function nativePackFiles(filesToPack, base, themeName) {
   if (!filesToPack || !filesToPack.length) {
      return '';
   }
   const results = await pMap(
      filesToPack,
      module => commonPackage.getLoader(module.plugin)(module, base, themeName),
      { concurrency: 10 }
   );
   return results.reduce(function concat(res, modContent) {
      return res + (res ? '\n' : '') + modContent;
   }, '');
}

/**
 * Пакует переданные css. Делит пакет на пачки по 4000 правил (ie8-9)
 * @param {Array.<String>} files - пути до файлов
 * @param {String} root - корень сайта
 */
async function packCSS(files, root, resourceRoot) {
   const filesContent = {};
   await pMap(
      files,
      async(filePath) => {
         if (!fs.pathExists(filePath)) {
            return;
         }
         const content = await fs.readFile(filePath, 'utf8');
         filesContent[filePath] = cssHelpers.rebaseUrls(root, filePath, content.toString(), resourceRoot);
      },
      { concurrency: 5 }
   );

   const results = [];
   Object.keys(filesContent).sort().forEach((currentKey) => {
      results.push(filesContent[currentKey]);
   });
   const cssPackage = cssHelpers.bumpImportsUp(results.join('\n'));
   return [cssPackage];
}

/**
 * Формирует фейковые обертки для css, чтобы не грузить дважды
 * @param {Array} filesToPack
 * @param {Array} staticHtmlName
 * @return {String}
 */
function generateFakeModules(filesToPack, themeName, staticHtmlName) {
   return `(function(){\n${filesToPack
      .filter(function removeControls(module) {
         if (
            themeName ||
            (!process.application && staticHtmlName && HTMLPAGESWITHNOONLINESTYLES.indexOf(staticHtmlName) > -1)
         ) {
            return !module.fullName.includes('SBIS3.CONTROLS');
         }
         return true;
      })
      .map(module => `define('${module.fullName}', '');`)
      .join('\n')}\n})();`;
}

/**
 * Формирует пакеты js, css и объект dict с пакетом для каждой локали
 * @param {Object} orderQueue - развернутый граф, разбитый на js, css, dict (словари локализации) и
 *    cssForLocale (css-ок для каждой локали)
 * @param {Array} orderQueue.js
 * @param {Array} orderQueue.css
 * @param {Array} orderQueue.dict
 * @param {Array} orderQueue.cssForLocale
 * @param {String} applicationRoot - полный путь до корня пакета
 * @param {String} themeName - название темы
 * @param {String} staticHtmlName - имя статической html странички
 */
async function getJsAndCssPackage(orderQueue, applicationRoot, themeName, staticHtmlName, resourceRoot) {
   const isOfflineClient = await checkItIsOfflineClient(applicationRoot);
   const jsForPack = orderQueue.js.filter((node) => {
      const fullPath = node.moduleYes ? node.moduleYes.fullPath : node.fullPath;

      /**
       * Исключаем все модули локализации из старой статической паковки. Они уже присутствуют в составе
       * основного пакета ядра core-core.package.min.js. Наличие данных модулей дополнительно ещё и в составе
       * статического старого пакета вызывает сбои в работе локализации, пример
       * https://online.sbis.ru/opendoc.html?guid=918ba0c0-be68-4643-a06d-0204cbf4d298
       */
      if (fullPath.includes('Core/i18n') || fullPath.endsWith('i18n.min.js')) {
         return false;
      }
      return node.amd;
   });
   const cssForPack = orderQueue.css
      .filter(function removeControls(module) {
         // TODO: Написать доку по тому как должны выглядеть и распространяться темы оформления. Это трэщ
         if (
            themeName ||
            (!process.application && staticHtmlName && HTMLPAGESWITHNOONLINESTYLES.indexOf(staticHtmlName) > -1) ||
            isOfflineClient
         ) {
            // TODO Косытыль чтобы в пакет не попадали css контролов. Необходимо только для PRESTO И CARRY.
            return !module.fullName.startsWith('css!SBIS3.CONTROLS/') && !module.fullName.startsWith('css!Controls/');
         }
         return true;
      })
      .map(function onlyPath(module) {
         return module.fullPath;
      });

   const dictResult = {}, localeCssResult = {};
   const [jsResult, cssResult] = await Promise.all([
      nativePackFiles(jsForPack, applicationRoot, themeName),
      packCSS(cssForPack, applicationRoot, resourceRoot),
      Promise.all(
         Object.keys(orderQueue.dict).map(async(locale) => {
            dictResult[locale] = await nativePackFiles(orderQueue.dict[locale], applicationRoot);
         })
      ),
      Promise.all(
         Object.keys(orderQueue.cssForLocale).map(async(locale) => {
            localeCssResult[locale] = await packCSS(
               orderQueue.cssForLocale[locale].map(function onlyPath(module) {
                  return module.fullPath;
               }),
               applicationRoot,
               resourceRoot
            );
         })
      )
   ]);

   return {
      js: [generateFakeModules(orderQueue.css, themeName, staticHtmlName), jsResult].filter(i => !!i).join('\n'),
      css: cssResult.filter(i => !!i),
      dict: dictResult,
      cssForLocale: localeCssResult
   };
}

/**
 * Формирует объект с пакетами js, css и объект dict с пакетом для каждой локали
 * @param {DepGraph} dg - граф зависимостей
 * @param {Array} modArray - массив вершин
 * @param {String} root - корень сервиса
 * @param {String} applicationRoot - корень сервиса
 * @param {String} themeName - имя темы
 * @param {String} staticHtmlName - имя статической html странички
 */
function packInOrder(dg, modArray, root, applicationRoot, themeName, staticHtmlName, availableLanguage, resourceRoot) {
   let orderQueue;

   orderQueue = dg.getLoadOrder(modArray);
   orderQueue = commonPackage.prepareOrderQueue(dg, orderQueue, applicationRoot);
   orderQueue = commonPackage.prepareResultQueue(orderQueue, applicationRoot, availableLanguage);

   return getJsAndCssPackage(orderQueue, root, themeName, staticHtmlName, resourceRoot);
}

function insertAllDependenciesToDocument(filesToPack, type, insertAfter) {
   const type2attr = {
      js: 'src',
      css: 'href'
   };
   const type2node = {
      js: 'script',
      css: 'link'
   };
   const type2type = {
      js: 'text/javascript',
      css: 'text/css'
   };
   const options = {
      'data-pack-name': `ws-mods-${type}`,
      type: type2type[type]
   };

   if (insertAfter && filesToPack && filesToPack[type]) {
      const curFilesToPack = filesToPack[type];

      if (curFilesToPack.length && type in type2attr) {
         if (type === 'css') {
            options.rel = 'stylesheet';
         }
         let newTarget = domHelpers.mkCommentNode(insertAfter.ownerDocument, '[/packedScripts]');
         insertAfter.parentNode.insertBefore(newTarget, insertAfter.nextSibling);
         curFilesToPack
            .reverse()
            .filter(file => file.name)
            .forEach((file) => {
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

function generatePackage(
   taskParameters,
   extWithoutVersion,
   filesToPack,
   ext,
   packageTarget,
   application,
   siteRoot,
   needReplacePaths,
   resourcesPath,
   namePrefix = ''
) {
   if (filesToPack) {
      let filesToPackList = filesToPack;
      if (typeof filesToPackList === 'string') {
         filesToPackList = [filesToPackList];
      }

      return filesToPackList.map((text) => {
         const packageName = namePrefix + domHelpers.uniqname(text, ext),
            packedFileName = path.join(packageTarget, packageName);

         const moduleName = packageTarget.split('/')[0];

         /**
          * создадим мета-данные для модуля, если этого не было сделано в рамках
          * Инкрементальной сборки
          */
         if (!taskParameters.versionedModules[moduleName]) {
            taskParameters.versionedModules[moduleName] = [];
         }
         if (!taskParameters.cdnModules[moduleName]) {
            taskParameters.cdnModules[moduleName] = [];
         }
         taskParameters.versionedModules[moduleName].push(
            helpers.prettifyPath(packedFileName.replace(ext, extWithoutVersion))
         );
         taskParameters.cdnModules[moduleName].push(
            helpers.prettifyPath(packedFileName.replace(ext, extWithoutVersion))
         );
         const packedFilePath = path.normalize(path.join(resourcesPath, packedFileName));

         // eslint-disable-next-line no-sync
         fs.outputFileSync(packedFilePath.replace(ext, extWithoutVersion), text);

         /**
          * resourcesPath is the same in full build and patch build. Use it
          * to get proper relative path for current package
          */
         let newName = `${packedFilePath.replace(resourcesPath, '')}`;
         if (!needReplacePaths) {
            newName = `%{RESOURCE_ROOT}${helpers.removeLeadingSlashes(newName.replace(/resources(?:\/|\\)/, ''))}`;
         } else {
            newName = helpers.prettifyPath(path.join('/', application, `resources/${newName}`));
         }

         return {
            name: newName,
            skip: !!namePrefix
         };
      });
   }
   return {};
}

function getStartNodes(divs) {
   let startNodes = [],
      div,
      tmplName;

   for (let i = 0, l = divs.length; i < l; i++) {
      div = divs[i];
      const divClass = div.getAttribute('class');
      tmplName = div.getAttribute('data-template-name');
      if (divClass && divClass.indexOf('ws-root-template') > -1 && tmplName) {
         logger.debug(`Packing inner template '${tmplName}'`);

         if (!tmplName.includes('!')) {
            startNodes = [...startNodes, tmplName];
         }

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
   return buildNumber ? `${key}?x_module=${buildNumber}` : key;
}

/**
 * Достаём тему из wsConfig и если она задана, значит паковать
 * надо с учётом этой темы
 */
function getThemeFromWsConfig(wsConfig) {
   // нужно очистить текст скрипта от невалидных конструкций
   const script = wsConfig.firstChild.data
      .replace('%{CONFIG.GLOBAL_PARAMS}', 'true')
      .replace('%{CONFIG.USER_PARAMS}', 'false');
   const ast = esprima.parseScript(script, { tolerant: true });
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
async function packageSingleHtml(
   taskParameters,
   filePath,
   dom,
   root,
   packageHome,
   dg,
   application,
   buildNumber,
   needReplacePaths,
   resourcesPath,
   availableLanguage
) {
   const newDom = dom,
      divs = newDom.getElementsByTagName('div'),
      jsTarget = newDom.getElementById('ws-include-components'),
      cssTarget = newDom.getElementById('ws-include-css'),
      htmlPath = filePath.split(path.sep),
      htmlName = htmlPath[htmlPath.length - 1],
      localeExcludeTargets = [],
      wsConfig = newDom.getElementById('ws-config');

   let themeName;

   if (wsConfig) {
      themeName = getThemeFromWsConfig(wsConfig);
   }

   if (!jsTarget && !cssTarget) {
      logger.debug(`No any packing target in '${filePath}'`);
      return newDom;
   }

   availableLanguage.forEach((locale) => {
      const localeExcludeTarget = newDom.getElementById(`builder-exclude-locale-${locale}`);
      if (localeExcludeTarget) {
         localeExcludeTargets.push(locale);
      }
   });
   const startNodes = getStartNodes(divs);

   const filesToPack = await packInOrder(
      dg,
      startNodes,
      root,
      root,
      themeName,
      htmlName,
      availableLanguage,
      path.join(taskParameters.config.applicationForRebase, 'resources/')
   );

   // Запишем в статическую html зависимости от ВСЕХ пакетов(основные js и css пакеты +
   // пакеты для каждой локали).
   // filesToPack = { "css": [], "js": "...", "dict": {"en-US": "", "ru-RU": ""},
   // "cssForLocale": {"en-US": []}};
   const attr2ext = {
         cssForLocale: 'css',
         dict: 'js'
      },
      packages = {
         css: [],
         js: []
      };

   for (const key of Object.keys(filesToPack)) {
      if (filesToPack[key] !== null && typeof filesToPack[key] === 'object') {
         if (Array.isArray(filesToPack[key])) {
            // "css": []
            filesToPack[key].forEach((content) => {
               packages[key] = packages[key].concat(
                  generatePackage(
                     taskParameters,
                     key,
                     content,
                     getKey(buildNumber, key),
                     packageHome,
                     application,
                     root,
                     needReplacePaths,
                     resourcesPath
                  )
               );
            });
         } else {
            // "dict": {"en-US": "", "ru-RU": ""}, "cssForLocale": {"en-US": []} lkz
            // пакеты для локалей запакуем с data-pack = "skip"
            // чтобы потом на ПП вырезать ненужные из html
            // Если разработчик задал таргеты для исключения пакетов локали из паковки статических html,
            // указанные таргеты пакетировать не будем.
            let availableLocalesToPack = Object.keys(filesToPack[key]);
            if (localeExcludeTargets.length > 0) {
               availableLocalesToPack = availableLocalesToPack.filter(locale => !localeExcludeTargets.includes(locale));
            }
            availableLocalesToPack.forEach((locale) => {
               packages[attr2ext[key]] = packages[attr2ext[key]].concat(
                  generatePackage(
                     taskParameters,
                     attr2ext[key],
                     filesToPack[key][locale],
                     getKey(buildNumber, attr2ext[key]),
                     packageHome,
                     application,
                     root,
                     needReplacePaths,
                     resourcesPath,
                     locale
                  )
               );
            });
         }
      } else {
         // "js": "..."
         const generatedScript = generatePackage(
            taskParameters,
            key,
            filesToPack[key],
            getKey(buildNumber, key),
            packageHome,
            application,
            root,
            needReplacePaths,
            resourcesPath
         );
         packages[key] = packages[key].concat(generatedScript);
      }
   }

   // пропишем в HTML
   insertAllDependenciesToDocument(packages, 'js', jsTarget);
   insertAllDependenciesToDocument(packages, 'css', cssTarget);

   return newDom;
}

module.exports = { packageSingleHtml };
