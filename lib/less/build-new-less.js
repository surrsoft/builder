'use strict';
const
   path = require('path'),
   helpers = require('../helpers'),
   { processLessFile } = require('./helpers');

async function buildNewLess(
   lessInfo,
   gulpModulesInfo
) {
   const {
      filePath,
      text,
      modulePath,
      newThemes,
      autoprefixerOptions
   } = lessInfo;
   const startTime = Date.now();
   const prettyFilePath = helpers.prettifyPath(filePath);

   const moduleName = path.basename(modulePath);
   try {
      const newThemeLessResult = await processLessFile(
         text,
         prettyFilePath,
         newThemes[moduleName],
         gulpModulesInfo,
         autoprefixerOptions
      );
      if (newThemeLessResult.error) {
         return Object.assign(newThemeLessResult, { passedTime: Date.now() - startTime });
      }
      return {
         compiled: newThemeLessResult,
         moduleName,
         themeName: newThemes[moduleName],
         passedTime: Date.now() - startTime
      };
   } catch (error) {
      return {
         error: error.message,
         passedTime: Date.now() - startTime
      };
   }
}

module.exports = buildNewLess;
