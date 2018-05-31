'use strict';

// предотвращение множественного запуска builder'а на одном кеше для предсказуемого результата.
const logger = require('../../../lib/logger').logger(),
   path = require('path'),
   fs = require('fs-extra');

module.exports = function generateTaskForSaveLoggerReport(config) {
   return function saveReport() {
      return new Promise(async(resolve, reject) => {
         try {
            const messages = logger.getMessageForReport();

            const reportFilePath = path.join(config.logFolder, 'builder_report.json');
            await fs.outputJSON(reportFilePath, { messages });
         } catch (error) {
            logger.error({ error });
            reject(error);
         }
         resolve();
      });
   };
};
