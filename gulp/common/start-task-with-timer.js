'use strict';

module.exports = function startTask(name, taskParameters, onStart, onFinish) {
   let startTime;
   const result = {};

   result.start = (done) => {
      startTime = Date.now();
      taskParameters.setCurrentTask(name);
      if (onStart) {
         onStart();
      }
      done();
   };

   result.setStartTime = () => {
      startTime = Date.now();
   };

   result.pluginFinish = (taskName, pluginName, onPluginFinish) => (done) => {
      taskParameters.storePluginTime(pluginName, startTime);
      taskParameters.storeTaskTime(taskName, startTime);
      if (onPluginFinish) {
         onPluginFinish();
      }
      done();
   };

   result.finish = (done) => {
      taskParameters.storeTaskTime(name, startTime);
      taskParameters.normalizePluginsTime();
      if (onFinish) {
         onFinish();
      }
      done();
   };

   return result;
};
