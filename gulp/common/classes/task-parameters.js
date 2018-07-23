/**
 * @author Бегунов Ал. В.
 */

'use strict';

/**
 * Класс с базовой информацией для всех gulp задач.
 */
class TaskParameters {
   /**
    * @param {BuildConfiguration|GrabberConfiguration} config конфигурация сборки
    * @param {Cache} cache кеш сборки статики или сборка фраз локализации
    * @param {Pool} pool пул воркеров
    */
   constructor(config, cache, pool = null) {
      this.config = config;
      this.cache = cache;
      this.pool = pool;
   }

   /**
    * Установить пул воркеров
    * @param {Pool} pool пул воркеров
    */
   setWorkerPool(pool) {
      this.pool = pool;
   }
}

module.exports = TaskParameters;
