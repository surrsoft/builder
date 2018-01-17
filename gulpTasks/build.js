'use strict';

const gulp = require('gulp'),
   path = require('path'),
   logger = require('./../lib/logger').logger;


module.exports = function buildTask(done, config) {
   const modulesList = config['modules'];
   for (let i = 0; i < modulesList.length; i++) {
      logger.progress(100 * i / modulesList.length);
      const module = modulesList[i],
         moduleNameWithResponsible = `${module.name} (responsible: ${module.responsible})`;
      logger.info(`Обработка модуля "${moduleNameWithResponsible}"`);
      logger.locationModule = moduleNameWithResponsible;

      const folderModule = path.basename(module.path),
         moduleInput = module.path + '/**/*.*',
         moduleOutput = path.join(config.output, folderModule);
      gulp.src(moduleInput)
         .pipe(gulp.dest(moduleOutput));
      logger.warning(222, 'многострочное предупреждение\nмногострочное предупреждение');
      logger.error(333, 'многострочная ошибка\nмногострочная ошибка');
   }
   logger.locationModule = null;

   logger.info('многострочное сообщение\nмногострочное сообщение');
   logger.warning(22, 'многострочное предупреждение\nмногострочное предупреждение');
   logger.error(33, 'многострочная ошибка\nмногострочная ошибка');
   done();

};

