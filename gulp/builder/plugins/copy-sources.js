/**
 * Плагин для удаления из потока Gulp исходников и мета-файлов,
 * которые не должны попасть в конечную директорию. Актуально для
 * Desktop-приложений.
 * @author Колбешин Ф.А.
 */

'use strict';

const through = require('through2');
const { checkSourceNecessityByConfig } = require('../../common/helpers');
const builderMeta = new Set([
   'module-dependencies.json',
   'navigation-modules.json',
   'routes-info.json',
   'static_templates.json'
]);
const helpers = require('../../../lib/helpers');
const path = require('path');
const extensions = new Set([
   '.js',
   '.tmpl',
   '.xhtml',
   '.less',
   '.wml',
   '.json',
   '.jstpl',
   '.css',
   '.es',
   '.ts',
   '.map'
]);

/**
 * Объявление плагина
 * @returns {stream}
 */
module.exports = function declarePlugin(taskParameters) {
   const buildConfig = taskParameters.config;
   const moduleDependencies = taskParameters.cache.getModuleDependencies();
   const jsModules = [];

   return through.obj(
      function onTransform(file, encoding, callback) {
         /**
          * не копируем мета-файлы билдера.
          */
         if (builderMeta.has(file.basename)) {
            callback(null);
            return;
         }

         /**
          * если файл нестандартного расширения, сразу копируем.
          */
         if (!extensions.has(file.extname)) {
            callback(null, file);
            return;
         }

         /**
          * contents помодульный нужен всегда, копируем его.
          */
         if (file.basename === 'contents.json') {
            callback(null, file);
            return;
         }

         if (!checkSourceNecessityByConfig(buildConfig, file.extname)) {
            callback(null);
            return;
         }

         if (!buildConfig.minimize) {
            callback(null, file);
            return;
         }
         const isMinified = file.basename.endsWith(`.min${file.extname}`);
         switch (file.extname) {
            case '.js':
               /**
                * нужно скопировать .min.original модули, чтобы не записать в кастомный
                * пакет шаблон компонента 2 раза
                */
               if (isMinified || file.basename.endsWith('.min.original.js')) {
                  jsModules.push(file);
                  callback(null, file);
                  return;
               }
               callback(null);
               return;
            case '.es':
            case '.ts':
            case '.less':
            case '.json':
               /**
                * конфиги для кастомной паковки нужно скопировать, чтобы создались кастомные пакеты
                */
               if (isMinified || file.basename.endsWith('.package.json')) {
                  callback(null, file);
                  return;
               }
               callback(null);
               return;

            // шаблоны, .css, .jstpl
            default:
               if (isMinified) {
                  callback(null, file);
                  return;
               }
               callback(null);
         }
      },

      /* @this Stream */
      function onFlush(callback) {
         const moduleDeps = taskParameters.cache.getModuleDependencies();
         const currentModulePrivateLibraries = new Set();
         Object.keys(moduleDeps.packedLibraries).forEach((currentLibrary) => {
            moduleDeps.packedLibraries[currentLibrary].forEach(
               currentModule => currentModulePrivateLibraries.add(currentModule)
            );
         });
         jsModules.forEach((currentModule) => {
            const prettyFilePath = helpers.unixifyPath(currentModule.path);
            const prettyRoot = helpers.unixifyPath(path.dirname(currentModule.base));
            const currentModuleName = helpers.removeLeadingSlash(prettyFilePath
               .replace(prettyRoot, '')
               .replace('.min.js', ''));

            if (currentModulePrivateLibraries.has(currentModuleName)) {
               return;
            }
            this.push(currentModule);
         });
         callback();
      }
   );
};
