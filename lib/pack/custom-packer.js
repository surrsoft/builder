'use strict';

const commonPackage = require('../../packer/lib/commonPackage'),
   fs = require('fs-extra'),
   logger = require('../../lib/logger').logger(),
   packerDictionary = require('../../packer/tasks/lib/packDictionary'),
   packHelpers = require('./helpers/custompack'),
   path = require('path'),
   pMap = require('p-map'),
   helpers = require('../../lib/helpers'),
   cssHelpers = require('../../packer/lib/cssHelpers');

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

   const result = await commonPackage.limitingNativePackFiles(
      packageConfig.orderQueue,
      root,
      application,
      availableLanguage,
      defaultLanguage,
      isGulp
   );

   /**
    * если в качестве результата нам вернулась пустая строка,
    * значит скорее всего создатели неправильно описали правила паковки
    */
   if (!result.unshift) {
      throw new Error('В ваш пакет ничего не запаковалось, проверьте правильность описания правил паковки в package.json файле');
   }

   if (packageConfig.cssModulesFromOrderQueue.length > 0) {
      result.unshift(
         packHelpers.generateLinkForCss(packageConfig.cssModulesFromOrderQueue, packageConfig.packagePath, splittedCore)
      );
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
         bundlesRoute: {}
      },
      cssCurrentTheme = {};

   let cssModulesFromOrderQueue = [],
      orderQueue;

   if (packageConfig.isBadConfig) {
      throw new Error('Конфиг для кастомного пакета должен содержать опцию include для нового вида паковки.');
   }
   orderQueue = packHelpers.getOrderQueue(depsTree, packageConfig, applicationRoot).filter((node) => {
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
            cssCurrentTheme
         }
      );
   }

   orderQueue = packerDictionary.deleteModulesLocalization(orderQueue);
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
async function saveBundlesForEachModule(applicationRoot, result, isGulp) {
   /**
    * Сделаем список json на запись, нам надо защититься от параллельной перезаписи
    */
   const jsonToWrite = {};
   await pMap(
      Object.keys(result.bundles),
      async(currentBundle) => {
         const intModuleName = currentBundle.match(/^resources\/([^/]+)/)[1],
            currentModules = result.bundles[currentBundle];
         let bundlePath;
         if (isGulp) {
            bundlePath = intModuleName;
         } else {
            bundlePath = `resources/${intModuleName}`;
         }
         bundlePath = path.normalize(path.join(applicationRoot, bundlePath, 'bundlesRoute.json'));

         if (await fs.pathExists(bundlePath)) {
            jsonToWrite[bundlePath] = await fs.readJson(bundlePath);
         }

         if (!jsonToWrite[bundlePath]) {
            jsonToWrite[bundlePath] = {};
         }

         currentModules.forEach((node) => {
            /**
             * временный костыль для старых контролов, для которых был сделан
             * exclude css!*, но cssки которых всё равно были записаны в бандл
             * в jsной форме(это было сделано из-за совпадающих имён компонента
             * и стиля). Они должны попадать в bundles, чтобы require не ошибался
             * при загрузке данного стиля, но не должны попадать в bundlesRoute, для
             * здоровья тех стилей, что были созданы с упором на порядок загрузки.
             */
            if (!node.startsWith('css!SBIS3.CONTROLS') &&
               (node.startsWith('css!') && !currentBundle.includes('SBIS3.ENGINE/Controls/engineclipboard'))
            ) {
               jsonToWrite[bundlePath][node] = result.bundlesRoute[node];
            }
         });
      },
      {
         concurrency: 10
      }
   );
   await pMap(Object.keys(jsonToWrite), key => fs.writeJson(key, jsonToWrite[key]), {
      concurrency: 10
   });
}

/**
 * Сохраняем результаты работы кастомной паковки для всех секций.
 */
async function saveCustomPackResults(result, applicationRoot, splittedCore, isGulp) {
   let wsRoot;
   if (isGulp) {
      wsRoot = 'WS.Core';
   } else {
      wsRoot = splittedCore ? 'resources/WS.Core' : 'ws';
   }
   const bundlesPath = 'ext/requirejs',
      bundlesRoutePath = path.join(wsRoot, bundlesPath, 'bundlesRoute').replace(/\\/g, '/'),
      pathsToSave = {
         bundles: path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.js'),
         bundlesJson: path.join(applicationRoot, wsRoot, bundlesPath, 'bundles.json'),
         bundlesRoute: path.join(applicationRoot, `${bundlesRoutePath}.json`)
      };

   if (wsRoot !== 'ws') {
      await saveBundlesForEachModule(applicationRoot, result, isGulp);
   }

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

async function getAllConfigs(files, applicationRoot) {
   const configs = [];
   await pMap(
      files,
      async(file) => {
         const packagePath = path.join(applicationRoot, file);
         let cfgContent;
         try {
            cfgContent = await fs.readJson(packagePath);
         } catch (err) {
            logger.error({
               message: 'Ошибка парсинга конфигурации кастомной паковки',
               error: err,
               filePath: file
            });
         }
         const currentFileConfigs = packHelpers.getConfigsFromPackageJson(packagePath, applicationRoot, cfgContent);
         configs.push(...currentFileConfigs);
      },
      {
         concurrency: 10
      }
   );
   return configs;
}

/**
 * Создаём кастомные пакеты по .package.json конфигурации.
 * Является общей для гранта и для гальпа, поскольку принимает массив конфигураций.
 * В гальпе её будем запускать(второй и последующие разы) в случае, когда какой-либо конфиг
 * начинает охватывать новые модули,
 */
async function generatePackageJsonConfigs(
   depsTree,
   configs,
   root,
   application,
   isSplittedCore,
   isGulp,
   availableLanguage,
   defaultLanguage
) {
   const results = {
      bundles: {},
      bundlesRoute: {}
   };

   await pMap(
      configs,
      async(config) => {
         const configNum = config.configNum ? `конфигурация №${config.configNum}` : '';
         try {
            /**
             * результатом выполнения функции мы сделаем объект, он будет содержать ряд опций:
             * 1)bundles: в нём будут храниться подвергнутые изменениям бандлы.
             * 2)bundlesRoute: тоже самое что и выше, только для bundlesRoute.
             */
            const currentResult = await generateCustomPackage(
               depsTree,
               root,
               application,
               config,
               isSplittedCore,
               isGulp,
               availableLanguage,
               defaultLanguage
            );
            packHelpers.appendBundlesOptionsToCommon(currentResult, results, 'bundles');
            packHelpers.appendBundlesOptionsToCommon(currentResult, results, 'bundlesRoute');
            logger.info(`Создан кастомный пакет по конфигурационному файлу ${config.packageName} - ${configNum}`);
         } catch (err) {
            logger.warning({
               message: `Ошибка создания кастомного пакета по конфигурационному файлу ${
                  config.packageName
               } - ${configNum}`,
               error: err,
               filePath: config.path
            });
         }
      },
      {
         concurrency: 3
      }
   );
   return results;
}

module.exports = {
   getAllConfigs,
   generatePackageJsonConfigs,
   saveCustomPackResults,
   generateCustomPackage,
   rebaseCSS
};
