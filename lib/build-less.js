'use strict';
const less = require('less'),
   path = require('path'),
   helpers = require('../lib/helpers'),
   logger = require('../lib/logger').logger();

const DEFAULT_THEME = 'online',
   themes = ['online', 'carry', 'presto', 'carrynew', 'prestonew'],
   dblSlashes = /\\/g,
   getModuleNameRegExp = /^resources[\/\\]([^\/\\]+)/,
   isControl = /resources(\\|\/)SBIS3\.CONTROLS/;

less.logger.addListener({
   debug: function(msg) {
      logger.debug('less.debug: ' + JSON.stringify(msg));
   },
   info: function(msg) {
      logger.debug('less.info: ' + JSON.stringify(msg));
   },
   warn: function(msg) {
      logger.debug('less.warn: ' + JSON.stringify(msg));
   },
   error: function(msg) {
      logger.debug('less.error: ' + JSON.stringify(msg));
   }
});

/**
 @workaround Временно ресолвим текущую тему по названию модуля.
 */
function resolveThemeName(filePath, resourcePath) {
   const relativePath = filePath.replace(resourcePath, ''),
      moduleName = helpers.getFirstDirInRelativePath(relativePath);

   switch (moduleName) {
      case 'Upravlenie_oblakom':
         return 'cloud';
      case 'Presto':
         return 'presto';
      case 'sbis.ru':
         return 'sbisru';
      case 'Retail':
         return 'carry';
      default:
         return 'online';
   }
}

function processLessFile(data, filePath, theme, resourcesPath, itIsControl) {
   return new Promise(function(resolve, reject) {
      try {
         const themesPath = path.join(resourcesPath, '/SBIS3.CONTROLS/themes/');

         let imports = '';
         if (theme) {
            imports = `@import '${themesPath}${theme}/variables';\n` +
               `@import '${themesPath}mixins';\n` +
               `@themeName: ${theme};\n`;
         }

         logger.debug('Компилируем файл: ' + filePath);
         logger.debug('Тема: ' + theme);
         logger.debug('Is' + itIsControl);
         less.render(imports + data, {
            filename: filePath,
            cleancss: false,
            relativeUrls: true,
            strictImports: true,
            paths: []
         }).then(
            output => {
               let suffix = '';

               if (itIsControl && theme !== DEFAULT_THEME) {
                  suffix = `__${theme}`;
               }
               let newFileName = `${path.basename(filePath, '.less')}${suffix}`;
               resolve({
                  fileName: newFileName,
                  text: output.css,
                  imports: output.imports
               });
            },
            error => {
               //error.filename может быть где-то в импортируемых лесс файлах. поэтому дублирования информации нет
               error.message = `Ошибка компиляции ${error.filename} на строке ${error.line}: ${error.message}`;
               reject(error);
            });
      } catch (error) {
         reject(error);
      }
   });
}


function buildLess(filePath, text, resourcePath) {
   return new Promise(function(resolve, reject) {
      try {
         if (helpers.getFirstDirInRelativePath(filePath) === 'SBIS3.CONTROLS') {
            const promises = [];
            for (let themeName of themes) {
               promises.push(processLessFile(text, filePath, themeName, resourcePath, true));
            }
            Promise.all(promises).then(
               results => {
                  resolve(results);
               },
               error => {
                  reject(error);
               });
         } else {
            const theme = resolveThemeName(filePath, resourcePath);
            processLessFile(text, filePath, theme, resourcePath, false)
               .then(
                  result => {
                     resolve([result]);
                  },
                  error => {
                     reject(error);
                  });
         }

      } catch (error) {
         reject(error);
      }
   });
}

module.exports = buildLess;

