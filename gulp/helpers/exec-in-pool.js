'use strict';

const logger = require('../../lib/logger').logger();

async function execInPool(pool, funcName, funcArgs, filePath = null, moduleInfo = null) {
   try {
      let moduleInfoObj;
      if (moduleInfo) {
         moduleInfoObj = {
            name: moduleInfo.name,
            responsible: moduleInfo.responsible,
            nameWithResponsible: moduleInfo.nameWithResponsible
         };
      }
      const [error, result, messagesForReport] = await pool
         .exec(funcName, [funcArgs, filePath, moduleInfoObj])
         .timeout(60000);
      logger.addMessagesFromWorker(messagesForReport);
      return [error, result];
   } catch (error) {
      return [error, null];
   }
}
module.exports = execInPool;
