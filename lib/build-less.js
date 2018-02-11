'use strict';
const less = require('less'),
   path = require('path'),
   helpers = require('../lib/helpers'),
   logger = require('../lib/logger').logger();

const defaultTheme = 'online';
const themes = [
   'carry',
   'carry_medium',
   'carrynew',
   'carrynew_medium',
   'cloud',
   'genie',
   'online',
   'presto',
   'presto_medium',
   'prestonew',
   'prestonew_medium'
];
const themesForModules = new Map([
   ['CloudControl', 'cloud'], //новое имя
   ['Upravlenie_oblakom', 'cloud'], //старое имя
   ['Presto', 'presto'],
   ['Retail', 'carry']
]);

const dblSlashes = /\\/g;

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
 @workaround ресолвим текущую тему по названию модуля или папке в темах
 */
function resolveThemeName(filePath, resourcePath) {
   const relativePath = filePath.replace(resourcePath, '');
   for (let themeName of themes) {
      if (relativePath.includes(`/themes/${themeName}/`)) {
         return themeName;
      }
   }
   const moduleName = getModuleName(filePath, resourcePath);
   if (themesForModules.has(moduleName)) {
      return themesForModules.get(moduleName);
   }
   return defaultTheme;
}

function processLessFile(data, filePath, theme, resourcesPath) {
   return new Promise(function(resolve, reject) {
      try {
         const themesPath = path.join(resourcesPath, 'SBIS3.CONTROLS/themes'),
            variablesPath = path.join(themesPath, theme, 'variables'),
            mixinsPath = path.join(themesPath, 'mixins');

         let imports = [];

         //чтобы исключить рекурсивный импорт
         if (!['variables.less', 'mixin.less'].includes(path.basename(filePath))) {
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
               let newFileName = path.basename(filePath, '.less');
               resolve({
                  fileName: newFileName, //TODO: избыточно, нужно удалить
                  text: output.css,
                  imports: output.imports
               });
            },
            error => {
               //error.line может не существовать.
               let errorLineStr = '';
               if (error.hasOwnProperty('line')) {
                  let errorLine = error.line;
                  if (path.normalize(error.filename) === path.normalize(filePath) && errorLine >= imports.length) {
                     //сколько строк добавили в файл, столько и вычтем для вывода ошибки
                     //в errorLine не должно быть отрицательных значений.
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
         logger.info(`Обрабатываем Файл ${filePath}`);
         filePath = filePath.replace(dblSlashes, '/');
         resourcePath = resourcePath.replace(dblSlashes, '/');
         const theme = resolveThemeName(filePath, resourcePath);
         processLessFile(text, filePath, theme, resourcePath)
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

