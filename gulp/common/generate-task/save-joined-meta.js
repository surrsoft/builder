/**
 * Сохраняем в корень каталога основные мета-файлы сборщика, используемые в дальнейшем
 * в онлайн-продуктах:
 * 1) contents - основная мета-информация, необходимая для настройки require и функционирования
 * приложения.
 * 2) module-dependencies - используется плагином SBIS Dependency Tree.
 * Остальные файлы(bundles.json и bundlesRoute.json) будут сохранены в соответствующей таске по
 * сохранению результатов кастомной паковки.
 * @author Колбешин Ф.А.
 */

'use strict';

const fs = require('fs-extra');
const path = require('path');

/**
 * Генерация задачи сохранения в корень каталога основных мета-файлов сборщика
 * @param{Object} taskParameters
 * @returns {*}
 */
module.exports = function generateTaskForSaveJoinedMeta(taskParameters) {
   if (!taskParameters.config.joinedMeta) {
      return function skipSavejoinedMeta(done) {
         done();
      };
   }
   return async function savejoinedMeta() {
      // save joined module-dependencies for non-jinnee application
      const root = taskParameters.config.rawConfig.output;
      if (taskParameters.config.dependenciesGraph) {
         await fs.writeJson(
            path.join(
               root,
               'module-dependencies.json'
            ),
            taskParameters.cache.getModuleDependencies()
         );
      }
      if (!taskParameters.config.customPack) {
         await fs.writeFile(path.join(root, 'bundles.js'), 'bundles={};');
      }
      if (taskParameters.config.commonContents) {
         await fs.writeJson(
            path.join(
               root,
               'contents.json'
            ),
            taskParameters.config.commonContents
         );
         await fs.writeFile(
            path.join(
               root,
               'contents.js'
            ),
            `contents=${JSON.stringify(taskParameters.config.commonContents)};`
         );
         if (taskParameters.config.isReleaseMode) {
            await fs.writeFile(
               path.join(
                  root,
                  'contents.min.js'
               ),
               `contents=${JSON.stringify(taskParameters.config.commonContents)};`
            );
         }
      }
      await fs.writeFile(
         path.join(
            root,
            'router.js'
         ),
         'define(\'router\', [], function(){ return {}; })'
      );
   };
};
