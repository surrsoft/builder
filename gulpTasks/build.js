'use strict';

const gulp = require('gulp'),
   gulpRename = require('gulp-rename'),
   path = require('path'),
   transliterate = require('./../lib/utils/transliterate'),
   ChangesStore = require('./helpers/changes-store'),
   changedInPlace = require('./changed-in-place'),
   clean = require('gulp-clean');


const copyTaskGenerator = function(moduleNameWithResponsible, modulePath, outputDir, changesStore) {
   const folderModule = path.basename(modulePath),
      moduleInput = modulePath + '/**/*.*',
      moduleOutput = path.join(outputDir, transliterate(folderModule));

   return function copy() {
      return gulp.src(moduleInput)
         .pipe(changedInPlace(changesStore, modulePath))
         .pipe(gulpRename(file => {
            file.dirname = transliterate(file.dirname);
            file.basename = transliterate(file.basename);
         }))
         .pipe(gulp.dest(moduleOutput));
   };
};

module.exports = {
   'create': function buildTask(config) {
      const modulesList = config['modules'];
      let copyTasks = [],
         changesStore = new ChangesStore(config['cache']);

      //TODO:
      for (let i = 0; i < modulesList.length; i++) {
         //for (let i = 0; i < 2; i++) {
         const module = modulesList[i];
         let moduleNameWithResponsible = module['name'];
         if (module['responsible']) {
            moduleNameWithResponsible += ` (responsible: ${module['responsible']})`;
         }

         copyTasks.push(copyTaskGenerator(moduleNameWithResponsible, module.path, config.output, changesStore));
      }
      const clearTask = function remove(done) {
         let pattern = [];

         for (let modulePath in changesStore.store) {
            if (changesStore.store.hasOwnProperty(modulePath)) {
               if (!changesStore.store[modulePath].exist) {
                  pattern.push(transliterate(path.basename(modulePath)) + '/**/*.*');
               } else {
                  let files = changesStore.store[modulePath]['files'];
                  for (let filePath in files) {
                     if (files.hasOwnProperty(filePath)) {
                        let fileInfo  = files[filePath];
                        if (!fileInfo.hasOwnProperty('exist')) {
                           const moduleName = path.basename(modulePath);
                           pattern.push(transliterate(path.join(moduleName, filePath)));
                        }
                     }
                  }
               }
            }
         }
         if (pattern.length) {
            return gulp.src(pattern, {read: false, cwd: config.output, allowEmpty: true})
               .pipe(clean());
         } else {
            done();
         }
      };


      const saveChangedStoreTask = function saveChangedStore(done) {
         changesStore.save();
         done();
      };

      return gulp.series(
         gulp.parallel(copyTasks),
         gulp.parallel(clearTask, saveChangedStoreTask));
   }
};
