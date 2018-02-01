'use strict';
const helpers = require('../lib/helpers'),
   fs = require('fs'),
   path = require('path'),
   humanize = require('humanize'),
   less = require('less'),
   getModuleNameRegExp = /^resources[\/\\]([^\/\\]+)/,
   DEFAULT_THEME = 'online',
   themes = ['online', 'carry', 'presto', 'carrynew', 'prestonew'],
   applicationRoot = path.join(process.env.ROOT, process.env.APPROOT),
   dblSlashes = /\\/g;

/**
 * подкладываем логи , чтобы понять что происходит на никсовой тачке и почему там
 * портятся стили, а в винде всё в порядке.
 */
var logs = '';

/**
 * Динамически генерируем регулярку с игнорируемыми названиями lessок
 */
function generateBlackListRegExp(ControlsLessBlackList) {
   var regExpString = ControlsLessBlackList.join('$|').replace(/\.less/g, '\\\.less');
   return new RegExp(regExpString);
}

/**
 @workaround Временно ресолвим текущую тему по названию модуля.
*/
function resolveThemeName(filepath) {
   filepath = filepath.replace(applicationRoot, '');
   if (filepath.indexOf('Retail') !== -1) {
      logs += `\nРезолвим тему для ${filepath}`;
   }
   let regexpMathch = filepath.match(getModuleNameRegExp, ''),
      s3modName = regexpMathch ? regexpMathch[1] : 'smth';
   if (filepath.indexOf('Retail') !== -1) {
      logs += `\nТема: ${filepath}`;
   }
   switch (s3modName) {
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

module.exports = function less1by1Task(grunt) {
   let root = grunt.option('root') || '',
      app = grunt.option('application') || '',
      rootPath = path.join(root, app),
      themesPath = path.join(rootPath, '/resources/SBIS3.CONTROLS/themes/');

   function processLessFile(data, filePath, error, theme, itIsControl) {
      if (!data) {
         return;
      }
      let lessData = data.toString(),
         imports = theme
            ? `
            @import '${themesPath}${theme}/variables';
            @import '${themesPath}mixins';
            @themeName: ${theme};

            ` : '';
      if (filePath.indexOf('Retail') !== -1) {
         logs += `\nimports получился таким: ${imports}`;
      }
      less.render(imports + lessData, {
         filename: filePath,
         cleancss: false,
         relativeUrls: true,
         strictImports: true
      }, function writeCSS(compileLessError, output) {

         if (compileLessError) {

            grunt.log.warn(`${compileLessError.message} in file: ${filePath} on line: ${compileLessError.line} `);
         }
         let suffix = '';

         if (itIsControl) {
            suffix = (theme === DEFAULT_THEME) ? '' : `__${theme}`;
         }
         let newName = `${path.dirname(filePath)}/${path.basename(filePath, '.less')}${suffix}.css`;
         if (output) {
            fs.writeFile(newName, output.css, {flag: 'wx'}, function writeFileCb(writeFileError) {
               if (writeFileError) {
                  grunt.log.ok(`Не могу записать файл. Ошибка: ${writeFileError.message}.`);
               }
               grunt.log.ok(`file ${filePath} successfuly compiled. Theme: ${theme}`);
            });
         }
      });
   }

   grunt.registerMultiTask('less1by1', 'Компилит каждую лесску, ложит cssку рядом. Умеет в темы', function() {
      grunt.log.ok(`${humanize.date('H:i:s')} : Запускается задача less1by1.`);

      let
         isControl = /resources(\\|\/)SBIS3\.CONTROLS/,
         taskDone = this.async(),
         blackListPath = path.join(applicationRoot, 'resources/SBIS3.CONTROLS/less-blacklist.json'),
         ControlsLessBlackList, lessBlackListRegExp;

      if (grunt.file.exists(blackListPath)) {
         ControlsLessBlackList = JSON.parse(grunt.file.read(blackListPath));
         lessBlackListRegExp = generateBlackListRegExp(ControlsLessBlackList);
      }

      helpers.recurse(rootPath, function(filepath, cb) {
         if (helpers.validateFile(path.relative(rootPath, filepath), ['resources/**/*.less', 'ws/**/*.less'])) {
            fs.readFile(filepath, function readFileCb(readFileError, data) {
               if (filepath.indexOf('Retail') !== -1) {
                  logs += `\nПрочитали файл ${filepath}`;
               }
               let theme = resolveThemeName(filepath);
               if (filepath.indexOf('Retail') !== -1) {
                  logs += `\nitIsControl: ${itIsControl(filepath)}`;
               }
               if (itIsControl(filepath)) {
                  for (let themeName of themes) {
                     processLessFile(data, filepath, readFileError, themeName, true);
                  }
               } else {
                  /**
                         * если less-ка имеет имя из чёрного списка и она лежит в контролах, то её не
                         компилим
                         */
                  if (!(isControl.test(filepath) && lessBlackListRegExp && lessBlackListRegExp.test(filepath))) {
                     processLessFile(data, filepath, readFileError, theme, false);
                  }
               }

            });
         }
         cb();
      }, function() {
         grunt.log.ok(`${humanize.date('H:i:s')} : Задача less1by1 выполнена.`);
         grunt.file.write(path.join(applicationRoot, 'resources', 'less-logs.txt'), logs);
         taskDone();
      });

   });


};
