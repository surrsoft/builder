'use strict';
const
   path = require('path'),
   fs = require('fs-extra'),
   assert = require('assert');

const
   runJsonGenerator = require('../../../lib/i18n/run-json-generator'),
   logger = require('../../../lib/logger').logger();

// cache и config для builder'а и grubber'а - разные классы!
function generateTaskForGenerateJson(cache, config, localizationEnable = true) {
   if (!localizationEnable) {
      return function generateJson(done) {
         done();
      };
   }
   return async function generateJson() {
      try {
         const folders = [];
         for (const module of config.modules) {
            folders.push(module.path);
         }
         const resultJsonGenerator = await runJsonGenerator(folders, config.cachePath);
         for (const error of resultJsonGenerator.errors) {
            logger.warning({
               message: 'Ошибка при разборе JSDoc комментариев',
               filePath: error.filePath,
               error: error.error
            });
         }

         // если components-properties поменялись, то нужно сбросить кеш для верстки
         let isComponentsPropertiesChanged = false;
         const filePath = path.join(config.cachePath, 'components-properties.json');
         if (await fs.pathExists(filePath)) {
            let oldIndex = {};
            try {
               oldIndex = await fs.readJSON(filePath);
            } catch (err) {
               logger.warning({
                  message: 'Не удалось прочитать файл кеша',
                  filePath,
                  error: err
               });
            }

            try {
               assert.deepEqual(oldIndex, resultJsonGenerator.index);
            } catch (error) {
               isComponentsPropertiesChanged = true;
            }
         } else {
            isComponentsPropertiesChanged = true;
         }
         if (isComponentsPropertiesChanged) {
            logger.info('Кеш для файлов верстки будет сброшен, если был.');
            cache.setDropCacheForMarkup();
            await fs.writeJSON(filePath, resultJsonGenerator.index, { spaces: 1 });
         }
      } catch (error) {
         logger.error({
            message: 'Ошибка Builder\'а. Задача generateJson',
            error
         });
      }
   };
}

module.exports = generateTaskForGenerateJson;
