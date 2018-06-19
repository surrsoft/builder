/**
 * @author Бегунов Ал. В.
 */

'use strict';

const through = require('through2'),
   path = require('path'),
   logger = require('../../../lib/logger').logger(),
   execInPool = require('../../helpers/exec-in-pool');

module.exports = function declarePlugin(config, changesStore, moduleInfo, pool) {
   return through.obj(async function onTransform(file, encoding, callback) {
      try {
         if (file.cached) {
            callback(null, file);
            return;
         }
         if (file.extname !== '.xhtml') {
            callback(null, file);
            return;
         }
         const componentsPropertiesFilePath = path.join(config.cachePath, 'components-properties.json');
         const [error, newText] = await execInPool(pool, 'prepareXHTML', [file.contents.toString(), componentsPropertiesFilePath]);
         if (error) {
            changesStore.markFileAsFailed(file.history[0]);
            logger.error({
               message: 'Ошибка при локализации XHTML',
               error,
               moduleInfo,
               filePath: file.path
            });
         } else {
            file.contents = Buffer.from(newText);
         }
      } catch (error) {
         changesStore.markFileAsFailed(file.history[0]);
         logger.error({
            message: 'Ошибка builder\'а при локализации XHTML',
            error,
            moduleInfo,
            filePath: file.path
         });
      }
      callback(null, file);
   });
};
