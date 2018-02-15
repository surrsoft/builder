/* eslint-disable no-invalid-this */

'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../lib/logger').logger(),
   transliterate = require('../../lib/transliterate');

module.exports = function(moduleInfo, pool) {
   return through.obj(async function(file, encoding, callback) {
      //нас не интересуют:
      //  не js-файлы
      //  *.test.js - тесты
      //  *.worker.js - воркеры
      //  *.routes.js - роутинг. обрабатывается в отдельном плагине
      //  файлы в папках node_modules - модули node.js
      //  файлы в папках design - файлы для макетирования в genie
      if (file.extname !== '.js' ||
         file.path.endsWith('.worker.js') ||
         file.path.endsWith('.test.js') ||
         file.path.includes('/node_modules/') ||
         file.path.includes('/design/')) {
         callback(null, file);
         return;
      }

      try {
         file.componentInfo = await pool.exec('parseJsComponent', [file.contents.toString()]);
         if (file.path.endsWith('.module.js') && file.componentInfo.hasOwnProperty('componentName') &&
            file.componentInfo.componentName.startsWith('js!')) {
            const relativePath = path.join(moduleInfo.folderName, file.relative);
            const componentName = file.componentInfo.componentName.replace('js!', '');
            moduleInfo.contents.jsModules[componentName] = transliterate(relativePath);
         }
      } catch (error) {
         logger.error({
            message: 'Ошибка при обработке JS компонента',
            filePath: file.history[0],
            error: error,
            moduleInfo: moduleInfo
         });
      }
      callback(null, file);
   });
};
