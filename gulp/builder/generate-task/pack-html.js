/**
 * @author Kolbeshin F.A.
 */

'use strict';
const gulp = require('gulp'),
   path = require('path'),
   plumber = require('gulp-plumber');

const logger = require('../../../lib/logger').logger(),
   DepGraph = require('../../../packer/lib/dependency-graph'),
   pluginPackHtml = require('../plugins/pack-html'),
   packInlineScripts = require('../plugins/pack-inline-scripts'),
   startTask = require('../../common/start-task-with-timer'),
   gulpIf = require('gulp-if');

/**
 * Generation of the task for static html pages packing.
 * @param{TaskParameters} taskParameters - whole parameters list(gulp configuration, all builder cache, etc. )
 * using by current running Gulp-task.
 * @returns {Undertaker.TaskFunction|function(done)} returns an empty function in case of un-appropriate flags to
 * avoid gulp unexpected completion with errors.
 */
function generateTaskForPackHtml(taskParameters) {
   if (!taskParameters.config.deprecatedStaticHtml && taskParameters.config.inlineScripts) {
      return function skipPackHtml(done) {
         done();
      };
   }
   const depGraph = new DepGraph();
   const tasks = taskParameters.config.modules.map((moduleInfo) => {
      const moduleOutput = path.join(taskParameters.config.rawConfig.output, path.basename(moduleInfo.output));
      const input = path.join(moduleOutput, '/**/*.html');

      return function packHtml() {
         return gulp
            .src(input, { dot: false, nodir: true })
            .pipe(
               plumber({
                  errorHandler(err) {
                     logger.error({
                        message: 'packHTML task was completed with errors',
                        error: err,
                        moduleInfo
                     });
                     this.emit('end');
                  }
               })
            )
            .pipe(gulpIf(
               taskParameters.config.deprecatedStaticHtml,
               pluginPackHtml(taskParameters, moduleInfo, depGraph)
            ))
            .pipe(gulpIf(
               !taskParameters.config.inlineScripts,
               packInlineScripts(taskParameters, moduleInfo)
            ))
            .pipe(gulp.dest(moduleOutput));
      };
   });

   const packHtml = startTask('static html packer', taskParameters);
   return gulp.series(
      packHtml.start,
      generateTaskForLoadDG(taskParameters.cache, depGraph),
      gulp.parallel(tasks),
      packHtml.finish
   );
}

function generateTaskForLoadDG(cache, depGraph) {
   return function load(done) {
      depGraph.fromJSON(cache.getModuleDependencies());
      done();
   };
}

module.exports = generateTaskForPackHtml;
