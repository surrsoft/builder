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

function itIsControl(path) {
   let truePath = path.replace(dblSlashes, '/');
   return ~truePath.indexOf('SBIS3.CONTROLS/components');
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

         less.render(imports + data, {
            filename: filePath,
            cleancss: false,
            relativeUrls: true,
            strictImports: true
         }, function(compileLessError, output) {
            if (compileLessError) {
               if (!output) {
                  compileLessError.message = `Ошибка компиляции less на строке ${compileLessError.line}: ${compileLessError.message}`;
                  reject(compileLessError);
                  return;
               } else {
                  logger.warning({
                     message: `Ошибка компиляции less на строке ${compileLessError.line}`,
                     error: compileLessError,
                     filePath: filePath
                  });
               }
            }
            if (!output) {
               resolve();
               return;
            }

            let suffix = '';

            if (itIsControl && theme !== DEFAULT_THEME) {
               suffix = `__${theme}`;
            }
            let newFileName = `${path.basename(filePath, '.less')}${suffix}.css`;
            resolve({
               fileName: newFileName,
               text: output
            });
         });

      } catch (error) {
         reject(error);
      }
   });
}


function buildLess(filePath, text, resourcePath) {
   return new Promise(function(resolve, reject) {
      try {
         if (itIsControl(filePath)) {
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

