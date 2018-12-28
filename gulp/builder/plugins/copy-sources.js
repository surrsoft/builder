/**
 * Плагин для удаления из потока Gulp исходников и мета-файлов,
 * которые не должны попасть в конечную директорию. Актуально для
 * Desktop-приложений.
 * @author Колбешин Ф.А.
 */

'use strict';

const through = require('through2');
const helpers = require('../../../lib/helpers');
const builderMeta = new Set([
   'module-dependencies.json',
   'navigation-modules.json',
   'routes-info.json',
   'static_templates.json'
]);

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

const deprecatedControlsToSave = [
   'ModalOverlay',
   'LoadingIndicator',
   'ProgressBar',
   'FieldString',
   'LinkButton',
   'Button',
   'FieldAbstract',
   'ButtonAbstract',
   'Menu'
];

/**
 * Проверяем WS.Deprecated модули, нам необходимо оставить в папке
 * Controls только неймспейсы deprecatedControlsToSave
 * @param{String} fullPath - полный путь до копируемого файла
 * @returns {boolean} true - не удаляем. false - удаляем.
 */
function checkPathForDeprecatedToRemove(fullPath) {
   if (fullPath.includes('WS.Deprecated/Controls')) {
      let result = false;
      deprecatedControlsToSave.forEach((currentControl) => {
         if (fullPath.includes(`WS.Deprecated/Controls/${currentControl}/`)) {
            result = true;
         }
      });
      return result;
   }
   return true;
}

/**
 * Объявление плагина
 * @returns {stream}
 */
module.exports = function declarePlugin() {
   return through.obj(
      function onTransform(file, encoding, callback) {
         const prettyPath = helpers.prettifyPath(file.path);

         /**
          * не копируем мета-файлы билдера.
          * Вычищаем ряд WS.Deprecated модулей и тему online по таргетам Чистова.
          * WS.Core/lib/Ext также не нужен в оффлайне, там лишь jquery.
          * TODO удалить эту жесть, когда будут завершены работы по задаче
          * https://online.sbis.ru/doc/c5c78f1d-2c47-49f3-9320-7606a5e75ed6
          */
         if (
            builderMeta.has(file.basename) ||
            !checkPathForDeprecatedToRemove(prettyPath) ||
            prettyPath.includes('SBIS3.CONTROLS/themes/online') ||
            prettyPath.includes('WS.Core/lib/Ext')
         ) {
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

         const isMinified = file.basename.endsWith(`.min${file.extname}`);
         switch (file.extname) {
            case '.js':
               /**
                * нужно скопировать .min.original модули, чтобы не записать в кастомный
                * пакет шаблон компонента 2 раза
                */
               if (isMinified || file.basename.endsWith('.min.original.js')) {
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
      }
   );
};
