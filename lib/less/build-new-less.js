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
         return newThemeLessResult;
      }
      return {
         compiled: newThemeLessResult,
         moduleName,
         themeName: newThemes[moduleName]
      };
   } catch (error) {
      return { error: error.message };
   }
}

module.exports = buildNewLess;
