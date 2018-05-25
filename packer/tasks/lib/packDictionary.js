'use strict';

const path = require('path'),
   fs = require('fs-extra'),
   pMap = require('p-map'),
   logger = require('../../../lib/logger').logger();
const dblSlashes = /\\/g;

/**
 * Возращает имя интерфейсного модуля.
 * @param {String} pathModule - путь до модуля.
 * @returns {String} - имя интерфейсного модуля.
 */

function getNameModule(pathModule) {
   const splitPath = pathModule.split('/');
   let nameModule = '';

   splitPath.some((name, index) => {
      if (name === 'ws') {
         nameModule = 'WS';
         return true;
      }
      if (name === 'resources') {
         nameModule = splitPath[index + 1];
         return true;
      }
      if (index === splitPath.length - 1) {
         [nameModule] = splitPath;
         return true;
      }
      return false;
   });

   return nameModule;
}

/**
 * Возращает путь до словаря.
 * @param {String} name - имя интерфейсного модуля.
 * @param {String} lang - язык для словаря до которого нужно построить путь.
 * @param {String} applicationRoot - путь до сервиса.
 * @returns {String} - путь до словаря.
 */
function getPathDict(name, lang, applicationRoot) {
   let realName = name;

   // Когда ws станет интерфейсным модулем можно удалить.
   if (realName === 'WS') {
      realName = 'ws';
   } else {
      realName = `resources/${realName}`;
   }

   return path.normalize(path.join(applicationRoot, realName, 'lang', lang, `${lang}.js`));
}

/**
 * Проверяет если уже в пакете словарь для данного интерфейсного модуля.
 * @param {String} name - имя интерфейсного модуля.
 * @param {String} lang - обробатываем язык.
 * @param {Boolean} isPackedDict - список словарей которые уже довлены в пакет.
 * @returns {boolean} true - если словарь надо пакетировать, false - если словарь не надо пакетировать.
 */
function needPushDict(name, lang, isPackedDict) {
   return !(isPackedDict[name] && isPackedDict[name][lang]);
}

/**
 * Возращает имя модуля-словаря.
 * @param {String} name - имя интерфейсного модуля.
 * @param {String} lang - обробатываем язык.
 * @returns {string} - имя модуля словаря.
 */
function getNameDict(name, lang) {
   return `${name}/lang/${lang}/${lang}`;
}

/**
 * Добавляет в module-dependencies.json узел для модуля словаря с плагином text!.
 * @param {object} modDeps - module-dependencies.json.
 * @param {Object} module - модуля словарь.
 * @returns {Object}
 */
function creatTextInModDeps(modDeps, module) {
   if (!modDeps.nodes.hasOwnProperty(module.fullName)) {
      modDeps.nodes[module.fullName] = {
         path: path.normalize(path.join('resources', module.module))
      };
      modDeps.links[module.fullName] = [];
   }

   return modDeps;
}

/**
 * Создаёт модуль с плагином text!.
 * @param {Object} modulejs - мета данные js-ого модуля словаря.
 * @returns {{amd: boolean, encode: boolean, fullName: string, fullPath: string, module: string, plugin: string}}
 *          - мета данные json модуля.
 */
function createTextModule(modulejs) {
   return {
      amd: false,
      encode: false,
      fullName: `text!${modulejs.fullName}.json`,
      fullPath: modulejs.fullPath.replace(/\.js$/, '.json'),
      module: `${modulejs.module}.json`,
      plugin: 'text'
   };
}

/**
 * Создаёт модуль с плагином js.
 * @param {String} nameModule - имя интерфейсного модуля.
 * @param {String} fullPath - полный путь до модуля.
 * @param {String} lang - обробатываем язык.
 * @returns {{amd: boolean, encode: boolean, fullName: string, fullPath: string, module: string, plugin: string}}
 *          - мета данные js модуля.
 */
function createJsModule(nameModule, fullPath, lang) {
   return {
      amd: true,
      encode: false,
      fullName: getNameDict(nameModule, lang),
      fullPath: fullPath.replace(dblSlashes, '/'),
      module: getNameDict(nameModule, lang),
      plugin: 'js'
   };
}

/**
 * Создаёт модуль пустышку с плагином i18n для кастмной паковки.
 * @param {String} nameModule - имя интерфейсного модуля.
 * @returns {{amd: boolean, encode: boolean, fullName: string, module: string, plugin: string}} - мета данные js модуля.
 */
function createI18nModule(nameModule) {
   return {
      amd: true,
      encode: false,
      fullName: `${nameModule}_localization`,
      module: `${nameModule}"_localization`,
      plugin: 'i18n'
   };
}

/**
 * Удаляет из зависимостей модуля все зависимости с плагином i18n.
 * @param {Array} deps - зависимости модуля.
 * @returns {Array}
 */
function deleteOldDepI18n(deps) {
   return deps.filter((dep) => {
      if (dep.indexOf('i18n!') === -1) {
         return true;
      }
      return false;
   });
}

/**
 * Возрашает доступные языки для интерфейсного модуля.
 * @param {Array} availableLanguage - список необходимых языков.
 * @param {String} nameModule - имя интерфейсного модуля.
 * @param {String} applicationRoot - путь до сервиса.
 * @returns {Object}
 */
function getAvailableLanguageModule(availableLanguage, nameModule, applicationRoot) {
   const availableLang = {};

   Object.keys(availableLanguage).forEach((lang) => {
      if (fs.existsSync(getPathDict(nameModule, lang, applicationRoot))) {
         availableLang[lang] = true;
      }
   });

   return availableLang;
}

/**
 * Возращает список модулей для кастомной паковки, с дабавленными модулями локализации.
 * @param {Array} modules - массив модулей из кастомного пакета.
 * @param {String} applicationRoot - путь до сервиса.
 * @returns {Array}
 */
async function packCustomDict(modules, applicationRoot) {
   let resultPackage = [];

   try {
      const modulesI18n = {},
         coreConstants = global.requirejs('Core/constants'),
         modDepend = await fs.readJson(path.join(applicationRoot, 'resources', 'module-dependencies.json')),
         linkModules = modDepend.links;
      let moduleName;

      await pMap(
         modules,
         async(module) => {
            if (linkModules.hasOwnProperty(module.fullName)) {
               linkModules[module.fullName] = deleteOldDepI18n(linkModules[module.fullName]);
               moduleName = getNameModule(module.fullPath);
               if (modulesI18n.hasOwnProperty(moduleName)) {
                  linkModules[module.fullName].push(modulesI18n[moduleName].fullName);
                  module.addDeps = modulesI18n[moduleName].fullName;
               } else if (await fs.pathExists(path.join(applicationRoot, 'resources', moduleName, 'lang'))) {
                  /**
                   * проверяем, чтобы существовала локализация для данного неймспейса, иначе нет смысла генерить
                   * для него в пакете модуль локализации
                   */
                  modulesI18n[moduleName] = createI18nModule(moduleName);
                  linkModules[module.fullName].push(modulesI18n[moduleName].fullName);
                  module.addDeps = modulesI18n[moduleName].fullName;
               }
            }
         },
         {
            concurrency: 20
         }
      );

      modDepend.links = linkModules;

      for (const name in modulesI18n) {
         if (!modulesI18n.hasOwnProperty(name)) {
            continue;
         }
         modulesI18n[name].availableDict = getAvailableLanguageModule(
            coreConstants.availableLanguage,
            name,
            applicationRoot
         );
         resultPackage.push(modulesI18n[name]);
      }

      resultPackage = resultPackage.concat(modules);
   } catch (error) {
      logger.error({
         error
      });
   }
   return resultPackage;
}

/**
 * Возращет список модулей словарей и локализации.
 * @param {Array} modules - массив js-модулей пакета.
 * @param {String} applicationRoot - путь до сервиса.
 * @returns {Object}
 */
function packDictClassic(modules, applicationRoot) {
   const dictPack = {};

   /*
   костыль для записи в словари. На препроцессоре в нескольких потоках может возникнуть ситуация,
   когда словари сформируются и начнут записываться в module-dependencies параллельно и одновременно
    */
   if (fs.existsSync(path.join(applicationRoot, 'resources', 'module-dependencies-locked.log'))) {
      return dictPack;
   }
   try {
      const coreConstants = global.requirejs('Core/constants'),
         isPackedDict = {};

      let modDepend = JSON.parse(fs.readFileSync(path.join(applicationRoot, 'resources', 'module-dependencies.json'))),
         dictJsModule,
         dictTextModule,
         nameModule;

      Object.keys(coreConstants.availableLanguage).forEach((lang) => {
         dictPack[lang] = [];
      });

      modules.forEach((module) => {
         if (module.fullPath) {
            nameModule = getNameModule(module.fullPath);
            Object.keys(dictPack).forEach((lang) => {
               const fullPath = getPathDict(nameModule, lang, applicationRoot);
               if (needPushDict(nameModule, lang, isPackedDict) && fs.existsSync(fullPath)) {
                  dictJsModule = createJsModule(nameModule, fullPath, lang);
                  dictTextModule = createTextModule(dictJsModule);

                  modDepend = creatTextInModDeps(modDepend, dictTextModule);

                  dictPack[lang].push(dictTextModule);
                  dictPack[lang].push(dictJsModule);

                  if (!isPackedDict[nameModule]) {
                     isPackedDict[nameModule] = {};
                  }
                  isPackedDict[nameModule][lang] = true;
               }
            });
         }
      });

      /*
        в 320 отключаем запись в module-dependencies, поскольку заглушка не помогает и ломает нам вёрстку.
        fs.writeFileSync(path.join(applicationRoot, 'resources', 'module-dependencies.json'),
        JSON.stringify(modDepend, null, 2));
        */
   } catch (error) {
      logger.error({
         error
      });
   }
   return dictPack;
}

/**
 * Удаляет из пакета все модули локализации.
 * @param {Array} modules - список js-модулей пакета.
 * @returns {Array}
 */
function deleteOldModulesLocalization(modules) {
   return modules.filter((module) => {
      if (module.plugin && module.plugin === 'i18n') {
         return false;
      }
      return !(module.fullName && /\/lang\/[\w-]+\/[\w-]+/.test(module.fullName));
   });
}

module.exports = {
   packerCustomDictionary: packCustomDict,
   packerDictionary: packDictClassic,
   deleteModulesLocalization: deleteOldModulesLocalization
};
