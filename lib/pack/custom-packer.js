'use strict';

const commonPackage = require('../../packer/lib/common-package'),
   fs = require('fs-extra'),
   logger = require('../../lib/logger').logger(),
   packerDictionary = require('../../packer/tasks/lib/pack-dictionary'),
   packHelpers = require('./helpers/custompack'),
   path = require('path'),
   pMap = require('p-map'),
   helpers = require('../../lib/helpers'),
   cssHelpers = require('../../packer/lib/css-helpers'),
   builderConstants = require('../../lib/builder-constants');

async function rebaseCSS(css, appRoot, urlServicePath, isGulp) {
   if (await fs.pathExists(css)) {
      const content = await fs.readFile(css);

      /**
       * для гальп нам надо ещё сформировать resourceRoot, поскольку в гальпе
       * относительный путь всегда формируется относительно интерфейсного модуля.
       * В гранте он формировался относительно корня приложения(именно приложения
       * а не сервиса)
       */
      let resourceRoot;
      if (isGulp) {
         resourceRoot = `${path.join(urlServicePath, 'resources/')}`;
      } else {
         resourceRoot = '/';
      }
      return cssHelpers.rebaseUrls(appRoot, css, content.toString(), resourceRoot);
   }
   return '';
}

async function customPackCSS(files, root, application, isGulp) {
   const results = await pMap(
      files,
      async(css) => {
         const result = await rebaseCSS(css, root, application, isGulp);
         return result;
      },
      {
         concurrency: 10
      }
   );

   return cssHelpers.bumpImportsUp(results.join('\n'));
}

async function writeCustomPackage(
   packageConfig,
   root,
   application,
   splittedCore,
   availableLanguage,
   defaultLanguage,
   isGulp
) {
   const currentFileExists = await fs.pathExists(packageConfig.outputFile),
      originalFileExists = await fs.pathExists(packHelpers.originalPath(packageConfig.outputFile));

   // Не будем портить оригинальный файл.
   if (currentFileExists && !originalFileExists) {
      await fs.copy(packageConfig.outputFile, packHelpers.originalPath(packageConfig.outputFile));
   }

   let result = await commonPackage.limitingNativePackFiles(
      packageConfig.orderQueue,
      root,
      application,
      availableLanguage,
      defaultLanguage,
      isGulp
   );

   if (packageConfig.cssModulesFromOrderQueue.length > 0) {
      if (!result) {
         result = [];
      }
      result.unshift(
         packHelpers.generateLinkForCss(packageConfig.cssModulesFromOrderQueue, packageConfig.packagePath, splittedCore)
      );
   } else if (!result.unshift) {
      /**
       * если в качестве результата нам вернулась пустая строка и при этом
       * полностью отсутствуют стили на запись в кастомный пакет, значит,
       * скорее всего, создатели неправильно описали правила паковки
       */
      throw new Error('В ваш пакет ничего не запаковалось, проверьте правильность описания правил паковки в package.json файле');
   }

   if (packageConfig.outputFile.includes('WS.Data')) {
      await fs.outputFile(packageConfig.outputFile, packHelpers.generatePackageToWrite(result));
   } else {
      if (packageConfig.optimized) {
         logger.warning({
            message: 'Использование неразрешённой опции optimized в конфигурации кастомной паковки. ' +
            'Пакет будет сохранён по стандартной схеме',
            filePath: packageConfig.path
         });
      }
      await fs.outputFile(
         packageConfig.outputFile,
         result ? result.reduce((res, modContent) => res + (res ? '\n' : '') + modContent) : ''
      );
   }
}

/**
 * Разбивает набор cssок по темам в соответствии с постфиксом _{themeName}
 * @param{Array} cssModules - набор css
 * @returns{Object} themeName: listOfCss
 */
function splitCssByThemes(cssModules, cssCurrentTheme) {
   const result = {};
   cssModules.forEach((module) => {
      const
         moduleName = module.moduleYes ? module.moduleYes.fullName : module.fullName,
         cssNameParts = moduleName.split('/').pop().split('_');

      let themeName = '';
      if (cssNameParts.length > 1) {
         themeName = cssNameParts.pop();
      }
      module.currentTheme = themeName;
      cssCurrentTheme[moduleName] = themeName;
      if (!result.hasOwnProperty(themeName)) {
         result[themeName] = [module];
      } else {
         result[themeName].push(module);
      }
   });
   return result;
}

async function generateCustomPackage(
   depsTree,
   root,
   application,
   packageConfig,
   isSplittedCore,
   isGulp,
   availableLanguage,
   defaultLanguage
) {
   const applicationRoot = path.join(root, application),
      outputFile = packHelpers.getOutputFile(packageConfig, applicationRoot, depsTree, isSplittedCore),
      packagePath = packHelpers.getBundlePath(outputFile, applicationRoot, isSplittedCore ? 'resources/WS.Core' : 'ws'),
      bundlePath = isGulp ? `resources${packagePath[0] !== '/' ? '/' : ''}${packagePath}` : packagePath,
      pathToCustomCSS = outputFile.replace(/(\.package)?(\.min)?\.js$/, ''),
      cssExtIncludesPackage = outputFile.replace(/(\.min)?\.js$/, '').endsWith('.package'),
      result = {
         bundles: {},
         bundlesRoute: {},
         excludedCSS: {}
      },
      cssCurrentTheme = {},
      excludedCSS = {};

   let cssModulesFromOrderQueue = [],
      orderQueue;

   if (packageConfig.isBadConfig) {
      throw new Error('Конфиг для кастомного пакета должен содержать опцию include для нового вида паковки.');
   }

   orderQueue = packHelpers.getOrderQueue(depsTree, packageConfig, excludedCSS, applicationRoot).filter((node) => {
      /**
       * Для обычных пакетов произведём фильтрацию тех модулей, что уже
       * записаны в приоритетных пакетах
       */
      if (node.plugin === 'js' || node.plugin === 'tmpl' || node.plugin === 'html') {
         return node.amd;
      }
      if (node.fullName.includes('css!')) {
         cssModulesFromOrderQueue.push(node);
         return false;
      }
      return true;
   });

   /**
    * пишем все стили по пути кастомного пакета в css-файл.
    */
   cssModulesFromOrderQueue = commonPackage.prepareResultQueue(
      cssModulesFromOrderQueue,
      applicationRoot,
      availableLanguage
   );
   if (cssModulesFromOrderQueue.css.length > 0) {
      const
         splittedCssByThemes = splitCssByThemes(cssModulesFromOrderQueue.css, cssCurrentTheme);

      await pMap(
         Object.keys(splittedCssByThemes),
         async(themeName) => {
            const cssRes = await customPackCSS(
               splittedCssByThemes[themeName]
                  .map(function onlyPath(module) {
                     return module.fullPath;
                  }),
               root,
               application,
               isGulp
            );
            await fs.outputFile(
               `${pathToCustomCSS}${themeName ? `_${themeName}` : ''}` +
               `${cssExtIncludesPackage ? '.package' : ''}${isSplittedCore ? '.min.css' : '.css'}`,
               cssRes
            );
         },
         {
            concurrency: 10
         }
      );
   }

   /**
    * Чистим всю локализацию до формирования bundles и bundlesRoute
    * @type {Array}
    */
   orderQueue = packerDictionary.deleteModulesLocalization(orderQueue);
   if (packageConfig.platformPackage || !packageConfig.includeCore) {
      const cssBundlePath = pathToCustomCSS.replace(helpers.unixifyPath(applicationRoot), '');
      result.bundles[bundlePath] = await packHelpers.generateBundle(
         orderQueue,
         cssModulesFromOrderQueue.css,
         isSplittedCore
      );
      result.bundlesRoute = packHelpers.generateBundlesRouting(
         result.bundles[bundlePath],
         bundlePath,
         {
            cssExtIncludesPackage,
            cssBundlePath,
            excludedCSS,
            cssCurrentTheme
         }
      );
   }

   packageConfig.orderQueue = await packerDictionary.packerCustomDictionary(
      orderQueue,
      applicationRoot,
      depsTree,
      availableLanguage,
      isGulp
   );
   packageConfig.outputFile = outputFile;
   packageConfig.packagePath = packagePath;
   packageConfig.cssModulesFromOrderQueue = cssModulesFromOrderQueue.css;
   result.output = packageConfig.outputFile;

   result.excludedCSS = excludedCSS;
   await writeCustomPackage(
      packageConfig,
      root,
      application,
      isSplittedCore,
      availableLanguage,
      defaultLanguage,
      isGulp
   );
   return result;
}

/**
 * Функция, которая сплитит результат работы таски custompack в секции bundles
 */
async function saveBundlesForEachModule(applicationRoot, result) {
   /**
    * Сделаем список json на запись, нам надо защититься от параллельной перезаписи
    */
   const jsonToWrite = {};
   await pMap(
      Object.keys(result.bundles),
      async(currentBundle) => {
         const intModuleName = currentBundle.match(/^resources\/([^/]+)/)[1],
            currentModules = result.bundles[currentBundle];

         const
            bundlesRoutePath = path.normalize(path.join(applicationRoot, intModuleName, 'bundlesRoute.json')),
            bundlesPath = path.normalize(path.join(applicationRoot, intModuleName, 'bundles.json'));

         if (await fs.pathExists(bundlesRoutePath)) {
            jsonToWrite[bundlesRoutePath] = await fs.readJson(bundlesRoutePath);
         }

         if (await fs.pathExists(bundlesPath)) {
            jsonToWrite[bundlesPath] = await fs.readJson(bundlesPath);
         }

         if (!jsonToWrite[bundlesRoutePath]) {
            jsonToWrite[bundlesRoutePath] = {};
         }

         if (!jsonToWrite[bundlesPath]) {
            jsonToWrite[bundlesPath] = {};
         }

         currentModules.forEach((node) => {
            /**
             * Все css-модули, которые были выкинуты из кастомных пакетов путём использования
             * опции exclude, не должны попадать в bundlesRoute, поскольку:
             * 1) При наличии одинаковых имён со своими компонентами css всё равно попадут в bundles,
             * но запишутся в js-пакет.
             * 2) Из 1го следует что такие cssки должны быть описаны в bundles(чтобы require не ошибался
             * и ходил за cssкой в jsный пакет, а не в cssный), но не должны быть описаны в bundlesRoute
             * (чтобы Сервис Представлений не вставлял cssный пакет и не обьявлял css как пустышку без
             * наличия стиля как такового
             */
            if (!result.excludedCSS.hasOwnProperty(node)) {
               jsonToWrite[bundlesRoutePath][node] = result.bundlesRoute[node];
            }
         });
         jsonToWrite[bundlesPath][currentBundle] = result.bundles[currentBundle];
      },
      {
         concurrency: 10
      }
   );
   await pMap(Object.keys(jsonToWrite), key => fs.outputJson(key, jsonToWrite[key]), {
      concurrency: 10
   });
}

/**
 * Сохраняем результаты работы кастомной паковки для всех секций.
 */
async function saveCustomPackResults(cache, result, applicationRoot, splittedCore) {
   const wsRoot = 'WS.Core';
   const bundlesPath = 'ext/requirejs',
      bundlesRoutePath = path.join(wsRoot, bundlesPath, 'bundlesRoute').replace(/\\/g, '/'),
      moduleDepsPath = path.join(applicationRoot, wsRoot, bundlesPath, 'module-dependencies.json'),
      pathsToSave = {
         bundles: path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.js'),
         bundlesJson: path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.json'),
         bundlesRoute: path.join(applicationRoot, `${bundlesRoutePath}.json`)
      };

   /**
    * пока записываем module-dependencies общей конвертации ГУЯ в WS.Core.
    * TODO спилить, как только сборщики сделают выкладку этого файла в артефакты сборки.
    */
   await fs.writeJson(moduleDepsPath, cache.getModuleDependencies());
   await saveBundlesForEachModule(applicationRoot, result);
   await pMap(Object.keys(pathsToSave), async(key) => {
      let json;

      // нам надо проверить, что нужные файлы уже были сгенерены(инкрементальная сборка)
      if (await fs.pathExists(pathsToSave[key])) {
         switch (key) {
            case 'bundlesRoute':
            case 'bundlesJson':
               json = await fs.readJson(pathsToSave[key]);
               break;
            default:
               // bundles
               try {
                  // для bundles надо сначала удалить лишний код, а только потом парсить json
                  json = JSON.parse((await fs.readFile(pathsToSave[key], 'utf8')).slice(8, -1));
               } catch (error) {
                  logger.debug({
                     message: `Проблема с разбором файла ${pathsToSave[key]}. Но это скорее всего нормально`,
                     error
                  });
               }
               break;
         }
      }

      // если файл существует и мы его прочитали, то просто дополняем его свежесгенеренными результатами.
      if (json) {
         Object.keys(result[key]).forEach((option) => {
            json[option] = result[key][option];
         });
      } else {
         json = result[key];
      }
      switch (key) {
         case 'bundlesRoute':
            await fs.outputJson(pathsToSave[key], json);
            logger.debug(`Записали bundlesRoute.json по пути: ${pathsToSave[key]}`);
            break;
         case 'bundlesJson':
            await fs.outputJson(pathsToSave[key], json);
            logger.debug(`Записали bundles.json по пути: ${pathsToSave[key]}`);
            break;
         default:
            // bundles
            await fs.writeFile(pathsToSave[key], `bundles=${JSON.stringify(json)};`);
            logger.debug(`Записали bundles.js по пути: ${pathsToSave[key]}`);

            /**
             * Таска минификации выполняется до кастомной паковки, поэтому мы должны для СП также
             * сохранить .min бандл
             */
            if (splittedCore) {
               await fs.writeFile(pathsToSave[key].replace(/\.js$/, '.min.js'), `bundles=${JSON.stringify(json)};`);
               logger.debug(
                  `Записали bundles.min.js по пути: ${path.join(
                     applicationRoot,
                     wsRoot,
                     bundlesPath,
                     'bundles.min.js'
                  )}`
               );
            }
            break;
      }
   });
}

/**
 * Создаёт кастомный пакет по текущей конфигурации. Записывает результаты компиляции
 * ( bundles и bundlesRoute) в общий набор - results
 * @param {TaskParameters} taskParameters параметры для задач
 * @param {DependencyGraph} depsTree граф зависимостей
 * @param {Object} currentConfig текущая конфигурация кастомной паковки
 * @param {Object}results общие результаты компиляции для всех кастомных пакетов
 * @param {String} root корень приложения
 * @returns {Promise<void>}
 */
async function compileCurrentPackage(taskParameters, depsTree, currentConfig, results, root) {
   let currentResult = {
      bundles: {},
      bundlesRoute: {},
      excludedCSS: {}
   };


   const configNum = currentConfig.configNum ? `конфигурация №${currentConfig.configNum}` : '';
   try {
      /**
       * результатом выполнения функции мы сделаем объект, он будет содержать ряд опций:
       * 1)bundles: в нём будут храниться подвергнутые изменениям бандлы.
       * 2)bundlesRoute: тоже самое что и выше, только для bundlesRoute.
       */
      currentResult = await generateCustomPackage(
         depsTree,
         root,

         // application
         '/',
         currentConfig,

         // isSplittedCore
         true,

         // isGulp
         true,

         taskParameters.config.localizations,
         taskParameters.config.defaultLocalization
      );
      packHelpers.appendBundlesOptionsToCommon(currentResult, results, 'excludedCSS');
      logger.info(`Создан кастомный пакет по конфигурационному файлу ${currentConfig.packageName} - ${configNum}- ${currentConfig.output}`);
   } catch (err) {
      logger.warning({
         message: `Ошибка создания кастомного пакета по конфигурационному файлу ${
            currentConfig.packageName} - ${configNum}- ${currentConfig.output}`,
         error: err,
         filePath: currentConfig.path
      });
   }
   packHelpers.appendBundlesOptionsToCommon(currentResult, results, 'bundles');
   packHelpers.appendBundlesOptionsToCommon(currentResult, results, 'bundlesRoute');
}

/**
 * Генерирует кастомные пакеты для всего набора конфигураций кастомной паковки.
 * Сперва приоритетные, для них создаётся набор записанных модулей. Затем обычные
 * пакеты, в которые уже не смогут попасть модули из приоритетных пакетов.
 * @param {Object} configs общий набор конфигураций кастомной паковки
 * @param {TaskParameters} taskParameters параметры для задач
 * @param {Object} depsTree граф зависимостей
 * @param {Object} results общие результаты компиляции для всех кастомных пакетов
 * @param {String} root корень приложения
 * @returns {Promise<void>}
 */
async function generateAllCustomPackages(configs, taskParameters, depsTree, results, root) {
   const configsArray = [...Object.keys(configs.commonBundles).map(key => configs.commonBundles[key])];
   if (configs.superBundles && configs.superBundles.length > 0) {
      configsArray.splice(configsArray.length, 0, ...configs.superBundles);
   }
   await pMap(
      configsArray,
      async(currentConfig) => {
         await compileCurrentPackage(taskParameters, depsTree, currentConfig, results, root);
      },
      {
         concurrency: 10
      }
   );
}

/**
 * Возвращаем название Интерфейсного модуля
 * @param {String} nodeName - полное имя модуля
 * @returns {*} Название Интерфейсного модуля
 */
function getUiModuleName(nodeName) {
   const firstModulePart = nodeName.split('/')[0];
   if (firstModulePart.includes('!')) {
      return firstModulePart.split('!').pop();
   }
   return firstModulePart;
}

/**
 * Разбиваем пересечения по Интерфейсным модулям
 * @param {String} root корень приложения
 * @param {Array[][]} intersects пересечения между кастомными пакетами
 * @returns {Promise<void>}
 */
async function splitIntersectsByUiModuleName(root, intersects) {
   const intersectsByUiModules = {};

   intersects.forEach((currentEntry) => {
      const
         currentModule = currentEntry[0],
         currentModuleIntersect = currentEntry[1].sort(),
         interfaceModule = getUiModuleName(currentModule);

      let currentUiIntersect = intersectsByUiModules[interfaceModule];
      if (!currentUiIntersect) {
         currentUiIntersect = {};
         currentUiIntersect[currentModule] = currentModuleIntersect;
         intersectsByUiModules[interfaceModule] = currentUiIntersect;
      } else {
         currentUiIntersect[currentModule] = currentModuleIntersect;
      }
   });

   await pMap(
      Object.entries(intersectsByUiModules),
      async(currentEntry) => {
         const
            currentUiModuleName = currentEntry[0],
            currentUiModuleIntersects = currentEntry[1],
            intersectOutput = path.join(root, `${currentUiModuleName}${builderConstants.metaFolder}customPackIntersects.json`);
         logger.info(
            `В Интерфейсном модуле ${currentUiModuleName} присутствуют пересечения между кастомными пакетами!` +
            ` Посмотреть можно в json-файле по пути ${intersectOutput}`
         );
         await fs.outputJson(intersectOutput, currentUiModuleIntersects);
      },
      {
         concurrency: 10
      }
   );
}

/**
 * Собираем в один файл все пересечения между кастомными пакетами.
 * @param {String} root - корень приложения
 * @param {Object} results - результаты создания кастомных пакетов
 * @returns {Promise<void>}
 */
async function collectAllIntersects(root, results) {
   const
      { bundles } = results,
      allBundlesRoute = {};

   Object.entries(bundles).forEach((currentEntry) => {
      const
         currentBundleName = currentEntry[0],
         currentBundle = currentEntry[1];

      currentBundle.forEach((module) => {
         if (!allBundlesRoute.hasOwnProperty(module)) {
            allBundlesRoute[module] = [currentBundleName];
         } else {
            allBundlesRoute[module].push(currentBundleName);
         }
      });
   });

   await splitIntersectsByUiModuleName(
      root,

      /**
       * оставляем только те модули, у которых больше 1 вхождения в кастомные пакеты
       */
      Object.entries(allBundlesRoute).filter(currentEntry => currentEntry[1].length > 1)
   );
}

module.exports = {
   generateAllCustomPackages,
   saveCustomPackResults,
   generateCustomPackage,
   rebaseCSS,
   collectAllIntersects
};
