'use strict';

const gulp = require('gulp'),
   gulpRename = require('gulp-rename'),
   path = require('path'),
   logger = require('./../lib/logger').logger,
   transliterate = require('./../lib/utils/transliterate');


const taskGenerator = function(moduleNameWithResponsible, modulePath, outputDir) {
   const folderModule = path.basename(modulePath),
      moduleInput = modulePath + '/**/*.*',
      moduleOutput = path.join(outputDir, transliterate(folderModule));

   return () => {
      return gulp.src(moduleInput)
         .pipe(gulpRename(file => {
            file.dirname = transliterate(file.dirname);
            file.basename = transliterate(file.basename);
         }))
         .pipe(gulp.dest(moduleOutput));
   };
};

module.exports = function buildTask(config) {
   const modulesList = config['modules'];
   let tasks = [];
   for (let i = 0; i < modulesList.length; i++) {
      const module = modulesList[i];
      let moduleNameWithResponsible = module['name'];
      if (module['responsible']) {
         moduleNameWithResponsible += ` (responsible: ${module['responsible']})`;
      }

      logger.info(`Обработка модуля "${moduleNameWithResponsible}"`);
      tasks.push(taskGenerator(moduleNameWithResponsible, module.path, config.output));
   }
   return tasks;
};

