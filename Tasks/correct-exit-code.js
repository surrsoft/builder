'use strict';

const logger = require('../lib/logger').logger();

//нам нужно собрать дистрибутив полностью, вывести все ошибки и только после свалится с кодом выхода 1 или 6.
//а grunt так не умеет. он может лишь падать при первой ошибке.
module.exports = function(grunt) {
   grunt.registerMultiTask('correct-exit-code', 'Корректируем код выхода при запуске default задачи', function() {
      logger.correctExitCode();
   });
};
