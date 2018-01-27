'use strict';

const gulp = require('gulp'),
   gulpRename = require('gulp-rename'),
   path = require('path'),
   transliterate = require('../lib/transliterate'),
   ChangesStore = require('./helpers/changes-store'),
   changedInPlace = require('./changed-in-place'),
   clean = require('gulp-clean');


const copyTaskGenerator = function(module, changesStore) {
   const moduleInput = path.join(module.path,  '/**/*.*');

   return function copy() {
      return gulp.src(moduleInput)
         .pipe(changedInPlace(changesStore, module.path))
         .pipe(gulpRename(file => {
            file.dirname = transliterate(file.dirname);
            file.basename = transliterate(file.basename);
         }))
         .pipe(gulp.dest(module.output));
   };
};

module.exports = {
   'create': function buildTask(config) {
      let copyTasks = [],
         changesStore = new ChangesStore(config.cachePath);

      for (let module of config.modules) {
         copyTasks.push(copyTaskGenerator(module, changesStore));
      }
      const clearTask = function remove(done) {
         let pattern = [];

         for (let modulePath in changesStore.store) {
            if (changesStore.store.hasOwnProperty(modulePath)) {
               if (!changesStore.store[modulePath].exist) {
                  pattern.push(transliterate(path.join(path.basename(modulePath)), '/**/*.*'));
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
