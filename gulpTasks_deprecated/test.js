'use strict';

const path                  = require('path');
const gulp                  = require('gulp');
const gutil                 = require('gulp-util');
const VFile                 = require('vinyl');
const sourcemaps            = require('gulp-sourcemaps');
const notify                = require('gulp-notify');
const gulpif                = require('gulp-if');

// const changed               = require('gulp-changed');
const through2              = require('through2').obj;
const uglify                = require('gulp-uglify');
const gzip                  = require('gulp-gzip');


module.exports = () => {
   return gulp.src(path.join(__dirname, '../tempGulp/src/index.js'))
      .pipe((() => {
         return through2(
            function(file, enc, cb) {
               console.log('file.path', file.path);
               cb(null, file);
            },
            function(cb) {
               this.push(new VFile({
                  base: path.join(__dirname, '../tempGulp/src'),
                  path: path.join(__dirname, '../tempGulp/src/indexCB1.js'),
                  contents: new Buffer('123')
               }));
               cb();
            }
         );
      })())
      .pipe((() => {
         return through2(
            function(file, enc, cb) {
               file.contents = new Buffer('vasya');
               cb(null, file);
            },
            function(cb) {
               this.push(new VFile({
                  base: path.join(__dirname, '../tempGulp/src'),
                  path: path.join(__dirname, '../tempGulp/src/indexCB2.js'),
                  contents: new Buffer('123')
               }));
               cb();
               cb();
            }
         );
      })())
      .pipe((() => {
         return through2(
            function(file, enc, cb) {
               file.contents = new Buffer('vasya2');
               cb(null, file);
            },
            function(cb) {
               cb();
            }
         );
      })())
      .pipe(gulp.dest(path.join(__dirname, '../tempGulp/dest')));
};
