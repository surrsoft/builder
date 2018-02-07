'use strict';
const less = require('less'),
   path = require('path'),
   helpers = require('../lib/helpers'),
   logger = require('../lib/logger').logger();

const DEFAULT_THEME = 'online',
   dblSlashes = /\\/g;

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

function getModuleName(filePath, resourcePath) {
   return helpers.getFirstDirInRelativePath(filePath.replace(resourcePath, ''));
}

/**
 @workaround ресолвим текущую тему по названию модуля.
 */
function resolveThemeName(filePath, resourcePath) {
   const relativePath = filePath.replace(resourcePath, '');

   switch (getModuleName(filePath, resourcePath)) {
      case 'CloudControl': //новое имя
      case 'Upravlenie_oblakom': //старое имя
         return 'cloud';
      case 'Presto':
         return 'presto';
      case 'sbis.ru':
         return 'sbisru';
      case 'Retail':
         if (relativePath.includes('/themes/presto/')) {
            //в модуле Retail теперь лежат файлы для темы presto
            return 'presto';
         }
         return 'carry';
      default:
         return 'online';
   }
}

function processLessFile(data, filePath, theme, resourcesPath, itIsControl) {
   return new Promise(function(resolve, reject) {
      try {
         const themesPath = path.join(resourcesPath, 'SBIS3.CONTROLS/themes'),
            variablesPath = path.join(themesPath, theme, 'variables'),
            mixinsPath = path.join(themesPath, 'mixins');

         let imports = [];
         if (theme) {
            imports = [`@import '${variablesPath}';`,
               `@import '${mixinsPath}';`,
               `@themeName: ${theme};`];
         }

         logger.debug(`Компилируем файл '${filePath}' для темы '${theme}'`);
         const newData = [].concat(imports, [data]).join('\n');
         less.render(newData, {
            filename: filePath,
            cleancss: false,
            relativeUrls: true,
            strictImports: true
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
               //error.line может не существовать.
               let errorLineStr = '';
               if (error.hasOwnProperty('line')) {
                  let errorLine = error.line;
                  if (error.filename === filePath) {
                     //сколько строк добавили в файл, столько и вычтем для вывода ошибки
                     errorLine -= imports.length;
                  }
                  errorLineStr = ` на строке ${errorLine.toString()}`;
               }

               //error.filename может быть где-то в импортируемых лесс файлах. поэтому дублирования информации нет
               error.message = `Ошибка компиляции ${error.filename}${errorLineStr}: ${error.message}`;
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
         filePath = filePath.replace(dblSlashes, '/');
         resourcePath = resourcePath.replace(dblSlashes, '/');
         const theme = resolveThemeName(filePath, resourcePath);
         processLessFile(text, filePath, theme, resourcePath, false)
            .then(
               result => {
                  resolve(result);
               },
               error => {
                  reject(error);
               });
      } catch (error) {
         reject(error);
      }
   });
}

module.exports = buildLess;

