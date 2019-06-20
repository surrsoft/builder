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
const privateModuleExt = /(\.min)?(\.js|\.wml|\.tmpl)/;

function getModuleNameWithPlugin(currentModule) {
   const prettyFilePath = helpers.unixifyPath(currentModule.path);
   const prettyRoot = helpers.unixifyPath(path.dirname(currentModule.base));
   const prettyRelativePath = helpers.removeLeadingSlash(prettyFilePath.replace(prettyRoot, ''));
   const currentModuleName = prettyRelativePath.replace(privateModuleExt, '');
   const currentPlugin = currentModule.extname.slice(1, currentModule.extname.length);
   const result = {
      currentRelativePath: prettyRelativePath
   };
   switch (currentPlugin) {
      case 'tmpl':
      case 'wml':
      case 'css':
         result.normalizedModuleName = `${currentPlugin}!${currentModuleName}`;
         break;
      case 'xhtml':
         result.normalizedModuleName = `html!${currentModuleName}`;
         break;
      default:
         result.normalizedModuleName = currentModuleName;
         break;
   }
   return result;
}

/**
 * Объявление плагина
 * @returns {stream}
 */
module.exports = function declarePlugin(taskParameters, moduleInfo) {
   const buildConfig = taskParameters.config;
   const modulesToCheck = [];
   const currentModuleName = helpers.prettifyPath(moduleInfo.output).split('/').pop();
   let versionedMetaFile, cdnMetaFile;

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

         if (file.basename === 'versioned_modules.json') {
            versionedMetaFile = file;
            callback(null);
            return;
         }
         if (file.basename === 'cdn_modules.json') {
            cdnMetaFile = file;
            callback(null);
            return;
         }
         if (!checkSourceNecessityByConfig(buildConfig, file.extname)) {
            callback(null);
            return;
         }

         const debugMode = !buildConfig.minimize;
         const isMinified = file.basename.endsWith(`.min${file.extname}`);
         switch (file.extname) {
            case '.js':
               /**
                * нужно скопировать .min.original модули, чтобы не записать в кастомный
                * пакет шаблон компонента 2 раза
                */
               if (debugMode || isMinified || file.basename.endsWith('.min.original.js')) {
                  modulesToCheck.push(file);
                  callback(null);
                  return;
               }
               callback(null);
               return;
            case '.json':
               /**
                * конфиги для кастомной паковки нужно скопировать, чтобы создались кастомные пакеты
                */
               if (debugMode || isMinified || file.basename.endsWith('.package.json')) {
                  callback(null, file);
                  return;
               }
               callback(null);
               return;
            case '.less':
            case '.ts':
            case '.es':
               callback(null);
               return;

            // templates, .css, .jstpl, typescript sources, less
            default:
               if (debugMode || isMinified) {
                  modulesToCheck.push(file);
               }
               callback(null);
               break;
         }
      },

      /* @this Stream */
      function onFlush(callback) {
         const moduleDeps = taskParameters.cache.getModuleDependencies();
         const currentModulePrivateLibraries = new Set();
         const modulesToRemoveFromMeta = new Set();
         Object.keys(moduleDeps.packedLibraries).forEach((currentLibrary) => {
            moduleDeps.packedLibraries[currentLibrary].forEach(
               currentModule => currentModulePrivateLibraries.add(currentModule)
            );
         });
         modulesToCheck.forEach((currentModule) => {
            const { normalizedModuleName, currentRelativePath } = getModuleNameWithPlugin(currentModule);

            // remove from gulp stream packed into libraries files
            if (currentModulePrivateLibraries.has(normalizedModuleName)) {
               modulesToRemoveFromMeta.add(currentRelativePath);
               return;
            }
            this.push(currentModule);
         });

         // remove private parts of libraries from versioned and cdn meta
         taskParameters.versionedModules[currentModuleName] = taskParameters.versionedModules[currentModuleName].filter(
            currentPath => !modulesToRemoveFromMeta.has(currentPath)
         );
         taskParameters.cdnModules[currentModuleName] = taskParameters.cdnModules[currentModuleName].filter(
            currentPath => !modulesToRemoveFromMeta.has(currentPath)
         );
         versionedMetaFile.contents = Buffer.from(JSON.stringify(
            taskParameters.versionedModules[currentModuleName].sort()
         ));
         cdnMetaFile.contents = Buffer.from(JSON.stringify(
            taskParameters.cdnModules[currentModuleName].sort()
         ));
         this.push(versionedMetaFile);
         this.push(cdnMetaFile);

         callback();
      }
   );
};
