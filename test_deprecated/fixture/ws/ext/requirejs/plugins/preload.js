/**
 * Created by Shilovda on 08.07.2015.
 */

(function() {

  'use strict';
   var global = (function(){ return this || (0,eval)('this'); }()),
       define = global.define || (global.requirejs && global.requirejs.define),
       buffer = [],
       busy = false,
       queue;

   /**
    * Пушим модули в очередь
    * Запускаем ParallelDeferred с шагом 1
    * Позволяет использовать всего 1 сокет для загрузки
    * @param {Array} items
    */
   function push(items) {
      if (items.length === 0) {
         return;
      }

      var pd = new $ws.proto.ParallelDeferred({
         maxRunningCount: 1,
         stopOnFirstError: false
      });

      $ws.helpers.forEach(items, function(item) {
         pd.push(function() {
            return $ws.require(item.module);
         });
      });

      queue.addCallback(function() {
         return pd.done().getResult();
      }).addErrback(function(error){
         // Я никогда не умру
         // Я буду вечно жить © Dolphin
         $ws.single.ioc.resolve('ILogger').error('Preloader', error);
         return true;
      });
   }

   /**
    * Получаем зависимости с роутинга.
    * На роутинге будет вызван метод получения всех зависимостей модуля и развернуты в плоский список.
    * Запустим этот список в цепочку на загрузку.
    * @return {$ws.proto.Deferred}
    */
   function getDependencies() {
      var def = new $ws.proto.Deferred();

      // Отфильтруем те, которые уже были подцеплены, и их вызвали по require
      buffer = $ws.helpers.filter(buffer, function(item) {
         return !global.requirejs.defined(item);
      });

      if (buffer.length === 0) {
         return def.callback();
      }

      var xhr = new XMLHttpRequest();
      xhr.open('GET', encodeURI('/depresolver/?modules=' + JSON.stringify(buffer)), true);

      buffer = []; // Обнуляем буфер
      xhr.onreadystatechange = function() {
         if (xhr.readyState == 4) {
            if (xhr.status >= 200 && xhr.status < 400) {
               try {
                  var result = JSON.parse(xhr.responseText);
                  push(result);
                  def.callback();
               } catch(err) {
                  def.errback(err);
               }
            } else {
               var err = new Error(xhr.responseText);
               err.code = xhr.status;
               def.errback(err);
            }
         }
      };
      xhr.send(null);

      return def;
   }

   /**
    * Инициируем загрузку зависимостей
    * busy - говорит о том, что цепочка занята, и просто будем копить все модули для подзагрузки до тех пор,
    * пока цепочка не выполнится, после запустим еще раз метод и возьмем новые модули из буфера.
    * Это позволит сократить количество GET запросов
    * @param {Array} items
    */
   function preload(items) {
      buffer = buffer.concat(items);
      if (!busy) {
         busy = true;
         queue.addCallback(function() {
            return getDependencies().addCallbacks(function() {
               // Как только метод getDependencies отработал в queue лежит цепочка зависимостей,
               // когда она отработает, стартанем еще раз метод preload, чтобы взять накопившееся в buffer
               queue.addCallback(function() {
                  busy = false;
                  if (buffer.length !== 0) {
                     preload([]); // Чтобы еще раз вызывался getDependencies
                  }
               });
            }, function(err) {
               busy = false;
               if (err.message.indexOf('DOCTYPE') > -1) {
                  // Предположительно вместо ошибки нам пришла страница с ошибкой
                  $ws.single.ioc.resolve('ILogger').error('Preloader', 'Unknown error with code: ' + err.code);
               } else {
                  $ws.single.ioc.resolve('ILogger').error('Preloader', err.message);
               }
               return true; // Чтобы деферед не умер
            });
         });
      }
   }

   define('preload', function() {
      if (typeof window == 'undefined') {
         return {
            load: function(n, r, load) {
               load()
            }
         };
      }

      queue = new $ws.proto.Deferred().callback();

      return {
         load: function (name, require, onLoad, conf) {
            name = name.split(';');
            if (typeof window === 'undefined') {
               onLoad(function() {});
            } else {
               onLoad(function() { preload(name); });
            }
         }
      }
   });
}());