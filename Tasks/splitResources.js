'use strict';

const fs = require('fs-extra'),
   humanize = require('humanize'),
   path = require('path'),
   helpers = require('../lib/helpers'),
   logger = require('../lib/logger').logger(),
   resources = 'resources';

function isNeededValue(key, value) {
   const matchs = value.match(key);
   return !!(matchs && matchs[1]);
}

function getName(filePath, isResources, isRootApp, sep) {
   let splittedPath;

   if (sep) {
      splittedPath = filePath.split(sep);
   } else {
      splittedPath = filePath.split('/');
   }

   if (splittedPath.indexOf('ws') > -1) {
      return '';
   }

   if (isRootApp) {
      return splittedPath[splittedPath.length - 1];
   }

   if (isResources) {
      const index = splittedPath.indexOf(resources);
      if (index === -1) {
         return '';
      }
      return splittedPath[index + 1];
   }

   return splittedPath[0];
}

module.exports = function splitResourcesTask(grunt) {
   const rootPath = path.join(grunt.option('root') || '', grunt.option('application') || '');

   function getPath(nameFile, nameModule, isResources) {
      let newPath;

      if (isResources) {
         newPath = path.join(rootPath, resources, nameFile);
      } else if (nameModule) {
         newPath = path.join(rootPath, resources, nameModule, nameFile);
      } else {
         newPath = path.join(rootPath, nameFile);
      }

      return path.normalize(newPath);
   }

   function writeFileInModules(data, name) {
      let pathModule;

      Object.keys(data).forEach((nameModule) => {
         pathModule = getPath(name, nameModule);

         try {
            let sortedContents;
            if (data[nameModule] instanceof Array) {
               sortedContents = data[nameModule].sort();
            } else {
               sortedContents = helpers.sortObject(data[nameModule]);
            }
            if (name !== 'contents.js') {
               fs.writeFileSync(pathModule, JSON.stringify(sortedContents, null, 2));
            } else {
               fs.writeFileSync(pathModule, `contents=${JSON.stringify(sortedContents)}`);
            }
         } catch (err) {
            logger.error({
               message: `Не смог записать файл: ${pathModule}`,
               error: err
            });
         }
      });
   }

   function getOptionModule(data, splitData, option) {
      const result = splitData;
      let nameModule;

      Object.keys(data[option]).forEach((key) => {
         if (option && option === 'dictionary') {
            return;
         }
         if (option === 'jsModules') {
            nameModule = getName(data[option][key], false, false);
         } else {
            nameModule = getName(data[option][key], true);
         }

         if (!nameModule) {
            return;
         }

         try {
            result[nameModule][option][key] = data[option][key];
         } catch (err) {
            logger.error({
               message: `Не смог корректно разобрать опцию из contents.json. Опция:${option} Модуль: ${
                  data[option][key]
               }`,
               error: err
            });
         }
      });

      return result;
   }

   function getOptionHtmlNames(data, splitData) {
      const result = splitData;
      let nameModule;

      Object.keys(data.htmlNames).forEach((key) => {
         nameModule = key.replace('js!', '');
         if (data.jsModules[nameModule]) {
            nameModule = getName(data.jsModules[nameModule], false, false);
         } else if (nameModule) {
            nameModule = getName(nameModule, false, false);
         } else {
            throw new Error(`Не смог найти модуль: ${nameModule} для статической страницы ${key}`);
         }

         if (!result[nameModule]) {
            throw new Error(`Модуль${nameModule}по ключу${key}не найден`);
         }
         result[nameModule].htmlNames[key] = data.htmlNames[key];
      });

      return result;
   }

   function getOptionDictionary(data, name) {
      const regExp = new RegExp(`(${name})(\\.)`),
         result = {};

      if (name === 'ws') {
         return result;
      }

      Object.keys(data).forEach((dist) => {
         if (isNeededValue(regExp, dist)) {
            result[dist] = data[dist];
         }
      });

      return result;
   }

   function splitRoutes() {
      logger.debug(`${humanize.date('H:i:s')} : Запускается подзадача разбиения routes-info.json`);

      const splittedRoutes = {},
         fullRoutes = JSON.parse(fs.readFileSync(getPath('routes-info.json', undefined, true)));
      let nameModule;

      try {
         Object.keys(fullRoutes).forEach((routes) => {
            nameModule = getName(routes, true, false, path.sep);

            if (!nameModule) {
               return;
            }

            if (!splittedRoutes[nameModule]) {
               splittedRoutes[nameModule] = {};
            }

            splittedRoutes[nameModule][routes] = fullRoutes[routes];
         });
      } catch (err) {
         logger.error({
            message: `Ошибка при обработке routes-info.json.\n Имя модуля: ${nameModule || ''}`,
            error: err
         });
      }

      return splittedRoutes;
   }

   function splitContents(fullContents) {
      logger.debug(`${humanize.date('H:i:s')} : Запускается подзадача разбиения contents.json`);

      let nameModule,
         splittedContents = {};

      try {
         Object.keys(fullContents.modules).forEach((module) => {
            nameModule = fullContents.modules[module];

            if (nameModule === 'ws/') {
               return;
            }

            splittedContents[nameModule] = {
               buildMode: fullContents.buildMode,
               htmlNames: {},
               jsModules: {},
               modules: {},
               requirejsPaths: {},
               services: fullContents.services,
               xmlContents: fullContents.xmlContents
            };

            splittedContents[nameModule].modules[module] = nameModule;
            if (fullContents.dictionary) {
               splittedContents[nameModule].availableLanguage = fullContents.availableLanguage;
               splittedContents[nameModule].defaultLanguage = fullContents.defaultLanguage;
               splittedContents[nameModule].dictionary = getOptionDictionary(fullContents.dictionary, nameModule);
            }
            if (fullContents.buildnumber) {
               splittedContents[nameModule].buildnumber = fullContents.buildnumber;
            }
         });

         nameModule = null;
         splittedContents = getOptionModule(fullContents, splittedContents, 'jsModules');

         // Почему-то не работает, но я узнаю почему!!!Или нет(
         // splittedContents = getOptionModule(fullContents, splittedContents, 'requirejsPaths');
         if (fullContents.htmlNames) {
            splittedContents = getOptionHtmlNames(fullContents, splittedContents);
         }
      } catch (err) {
         logger.error({
            message: `Ошибка при обработке contents.json.\n Имя модуля: ${nameModule || err}`,
            error: err
         });
      }

      return splittedContents;
   }

   // TODO Костыль для того что бы на сервисе-представлений модули из ws ссылались на WS.Core и WS.Deprecated
   function replaceWsInModDepend(modDepends) {
      const exception = [],
         fullModuleDep = {
            nodes: {},
            links: {}
         };
      let pathModule;
      Object.keys(modDepends.nodes).forEach((name) => {
         pathModule = modDepends.nodes[name].path;

         if (fs.existsSync(getPath(pathModule))) {
            fullModuleDep.nodes[name] = modDepends.nodes[name];
            fullModuleDep.links[name] = modDepends.links[name];
         } else {
            exception.push(pathModule);
         }
      });

      // Пока что не будет выводить список файлов которые не были найдены при распили module-dependencies.json
      /*
      if(exception.length !== 0) {
         logger.warning({
            message: 'Не смог найти файлы',
            filePath: exception.join(',\n')
         });
      }
      */

      return fullModuleDep;
   }

   function splitModuleDependencies() {
      logger.debug(`${humanize.date('H:i:s')} : Запускается подзадача разбиения module-dependencies.json`);

      const splitModuleDep = {};
      let existFile,
         nameModule = '',
         fullModuleDep = JSON.parse(fs.readFileSync(getPath('module-dependencies.json', undefined, true)));

      fullModuleDep = replaceWsInModDepend(fullModuleDep);

      try {
         Object.keys(fullModuleDep.nodes).forEach((node) => {
            existFile = fs.existsSync(getPath(fullModuleDep.nodes[node].path));
            if (!existFile) {
               if (node.indexOf('/cdn/') === -1) {
                  logger.warning(
                     `Не нашёл данный модуль ${node},\n по указанному пути ${fullModuleDep.nodes[node].path}`
                  );
               }
               return;
            }

            if (fullModuleDep.nodes[node].path) {
               nameModule = getName(fullModuleDep.nodes[node].path, true, false, path.sep);
            } else {
               logger.warning(`Не нашёл путь до модуля:  ${node}`);
               return;
            }

            if (!nameModule) {
               return;
            }

            if (!splitModuleDep[nameModule]) {
               splitModuleDep[nameModule] = {
                  nodes: {},
                  links: {}
               };
            }

            splitModuleDep[nameModule].nodes[node] = fullModuleDep.nodes[node];
            splitModuleDep[nameModule].links[node] = fullModuleDep.links[node];
         });
      } catch (err) {
         logger.error({
            message: `Ошибка при обработке module-dependencies.json.\n Имя модуля: ${nameModule}`,
            error: err
         });
      }
      return splitModuleDep;
   }

   function splitPreloadUrls(modules) {
      logger.debug(`${humanize.date('H:i:s')} : Запускается подзадача разбиения preload_urls.json`);

      const preloadUrls = {};
      let matchs, modulePreload, preload, allFiles, nameModules;

      Object.keys(modules).forEach((module) => {
         try {
            nameModules = getName(modules[module], true, false);

            if (!nameModules) {
               return;
            }

            allFiles = fs.readdirSync(getPath(nameModules, undefined, true));
            allFiles.some((file) => {
               if (file.indexOf('.s3mod') > -1) {
                  modulePreload = fs.readFileSync(getPath(file, nameModules), { encoding: 'utf8' }).replace(/\s/g, '');
                  return true;
               }
               return false;
            });

            matchs = modulePreload.match(/(<preload>)([\s\S]*)(<\/preload>)/);

            if (matchs && matchs[2]) {
               [,, matchs] = matchs;
            } else {
               return;
            }

            preload = matchs.match(/["|'][\w?=.#/\-&А-я]*["|']/g);
            preloadUrls[nameModules] = [];

            preload.forEach((value) => {
               preloadUrls[nameModules].push(value.replace(/['|"]/g, ''));
            });
         } catch (err) {
            logger.error({
               message: `Ошибка при обработке preload_urls.json.\n Имя модуля: ${nameModules}`,
               error: err
            });
         }
      });

      return preloadUrls;
   }

   function slpitStaticHtml(modules) {
      logger.debug(`${humanize.date('H:i:s')} : Запускается подзадача распределения статически html страничек`);

      let nameModules, pathContents, contents;

      Object.keys(modules).forEach((module) => {
         nameModules = getName(modules[module], true, false);

         if (!nameModules) {
            return;
         }

         try {
            pathContents = path.join(rootPath, resources, nameModules, 'contents.json');
            contents = JSON.parse(fs.readFileSync(pathContents, { encoding: 'utf8' }));
         } catch (err) {
            logger.error({
               message: `Не смог найти фалй contents.json.\n Имя модуля: ${nameModules}`,
               error: err
            });
         }

         const listPathStaticHtml = {},
            staticHtml = Object.keys(contents.htmlNames);
         let nameHtml;

         if (staticHtml.length !== 0) {
            staticHtml.forEach((Html) => {
               try {
                  nameHtml = getName(contents.htmlNames[Html], false, true);
                  listPathStaticHtml[nameHtml] = `${nameModules}/${nameHtml}`;
               } catch (err) {
                  logger.error({
                     message: `Не смог найти файл${nameHtml}`,
                     error: err
                  });
               }
            });
            const sorted = helpers.sortObject(listPathStaticHtml);

            const absoluteStaticTemplate = getPath('static_templates.json', nameModules);
            const isStaticTemplateExists = fs.pathExistsSync(absoluteStaticTemplate);
            let staticTemplates;
            if (isStaticTemplateExists) {
               staticTemplates = fs.readFileSync(absoluteStaticTemplate);
               staticTemplates = JSON.parse(staticTemplates);
            } else {
               staticTemplates = {};
            }
            Object.assign(staticTemplates, sorted);

            fs.writeFileSync(absoluteStaticTemplate, JSON.stringify(staticTemplates, undefined, 2));
         }
      });
   }

   grunt.registerMultiTask('splitResources', 'Разбивает мета данные по модулям', () => {
      try {
         const fullContents = JSON.parse(fs.readFileSync(getPath('contents.json', undefined, true)));

         logger.info(`${humanize.date('H:i:s')} : Запускается задача разбиения мета данных.`);

         writeFileInModules(splitRoutes(), 'routes-info.json');
         logger.debug(`${humanize.date('H:i:s')} : Подзадача разбиения routes-info.json успешно выполнена.`);

         const splitCont = splitContents(fullContents);
         writeFileInModules(splitCont, 'contents.json');
         writeFileInModules(splitCont, 'contents.js');
         logger.debug(`${humanize.date('H:i:s')} : Подзадача разбиения contents.json успешно выполнена.`);

         writeFileInModules(splitModuleDependencies(), 'module-dependencies.json');
         logger.debug(`${humanize.date('H:i:s')} : Подзадача разбиения module-dependencies.json успешно выполнена.`);

         if (fs.existsSync(getPath('preload_urls.json', undefined, true))) {
            writeFileInModules(splitPreloadUrls(fullContents.requirejsPaths), 'preload_urls.json');
            logger.debug(`${humanize.date('H:i:s')} : Подзадача разбиения preload_urls.json успешно выполнена.`);
         }

         slpitStaticHtml(fullContents.requirejsPaths);
         logger.debug(
            `${humanize.date('H:i:s')} : Подзадача распределения статически html страничек успешно выполнена.`
         );

         logger.info(`${humanize.date('H:i:s')} : Задача разбиения мета данных завершена успешно.`);

         logger.correctExitCode();
      } catch (err) {
         logger.error({ error: err });
      }
   });
};
