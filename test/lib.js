'use strict';

const trimLessError = function(message) {
   const startIndexForTriedBlock = message.indexOf(' Tried - ');
   if (startIndexForTriedBlock !== -1) {
      return message.slice(0, startIndexForTriedBlock);
   }
   return message;
};

module.exports = {
   trimLessError: trimLessError
};
