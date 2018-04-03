'use strict';

const through = require('through2'),
   path = require('path'),
   helpers = require('../../../lib/helpers'),
   logger = require('../../../lib/logger').logger(),
   transliterate = require('../../../lib/transliterate');

module.exports = function(changesStore, moduleInfo, pool) {
   return through.obj(async function(file, encoding, callback) {
      if (file.cached) {
         callback(null, file);
         return;
      }
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
      let componentInfo;
      try {
         componentInfo = await pool.exec('parseJsComponent', [file.contents.toString()]);
      } catch (error) {
         logger.error({
            message: 'Ошибка при обработке JS компонента',
            filePath: file.history[0],
            error: error,
            moduleInfo: moduleInfo
         });
      }
      changesStore.storeComponentInfo(file.history[0], moduleInfo.name, componentInfo);
      callback(null, file);
   }, function(callback) {
      try {
         const componentsInfo = changesStore.getComponentsInfo(moduleInfo.name);
         Object.keys(componentsInfo).forEach(filePath => {
            const info = componentsInfo[filePath];
            if (filePath.endsWith('.module.js') && info.hasOwnProperty('componentName') &&
               info.componentName.startsWith('js!')) {
               const relativePath = path.relative(path.dirname(moduleInfo.path), filePath);
               const componentName = info.componentName.replace('js!', '');
               moduleInfo.contents.jsModules[componentName] = helpers.prettifyPath(transliterate(relativePath));
            }
         });
      } catch (error) {
         logger.error({
            message: 'Ошибка Builder\'а',
            error: error,
            moduleInfo: moduleInfo
         });
      }
      callback();
   });
};
