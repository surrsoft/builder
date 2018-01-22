var wsPath = process.env.WS;
var uiModulesList = process.env.INPUT;
var cloudPath = process.env.CLOUD;
var outputDir = process.env.OUTPUT;
var jsonTempDir = process.env.CACHE;

var mkdirp = require('mkdirp');
var sbis3JsonGenerator = require('sbis3-json-generator/genieInterface');
var path = require('path');
var fs = require('fs');

process.argv.forEach(function(val) {
   var s = val.split('='),
      key = s[0],
      value = s[1];

   if (key == 'cloud') {
      cloudPath = value || cloudPath;
   } else if (key == 'ws') {
      wsPath = value || wsPath;
   } else if (key == 'output') {
      outputDir = value || outputDir;
   } else if (key == 'input') {
      uiModulesList = value || uiModulesList;
   } else if (key == 'cache') {
      jsonTempDir = value || jsonTempDir;
   }
});

if (!outputDir) {
   outputDir = jsonTempDir;
}

var dirs = JSON.parse(fs.readFileSync(uiModulesList).toString());

if (jsonTempDir === '') {
   jsonTempDir = outputDir + '.temp';
}

if (wsPath) {
   dirs.unshift(wsPath);
}

mkdirp.sync(jsonTempDir);

dirs = dirs.filter(function(d) {
   if (!fs.existsSync(d)) {
      var msg = 'generateJson error: file not found ' + d;
      console.error(msg);
      console.log(msg);
      return false;
   }
   return true;
});

var ProgressStatus = {
   queuedTaskCount: 0,
   doneTaskCount: 0,
   lastPercent: 0,
   prevTaskId: null,
   lastTaskId: null,

   lastTaskCount: 0,
   lastHeartBeat: new Date(),

   newTask: function() {
      this.queuedTaskCount++;
   },

   taskDone: function(taskId) {
      this.doneTaskCount++;

      var newPercent;
      if (this.queuedTaskCount) {
         newPercent = Math.floor(this.doneTaskCount * 100 / this.queuedTaskCount);
      } else {
         newPercent = 0;
      }

      //"анти-дребезг": из-за двупоточности на границе меж модулями может проскочить старый. Избавимся от этого.
      if (taskId == this.prevTaskId) {
         taskId = this.lastTaskId;
      }

      if (newPercent > this.lastPercent || taskId != this.lastTaskId) {
         this.lastPercent = newPercent;
         if (taskId != this.lastTaskId) {
            this.prevTaskId = this.lastTaskId;
            this.lastTaskId = taskId;
         }
         this.log(newPercent, taskId);
      }

      var
         now = new Date(),
         timePassed = (now - this.lastHeartBeat) / 1000;
      if ((this.doneTaskCount - this.lastTaskCount) > 100 && timePassed > 10) {
         console.log('heartbeat', this.doneTaskCount, now);
         this.lastTaskCount = this.doneTaskCount;
         this.lastHeartBeat = now;
      }
   },

   log: function(percent, msg) {
      console.log('[' + percent + '%]generateJson ' + msg);
   }
};

//Копипаста из sbis3-genie/.../i18nGenerator.js
function helperType(elem) {
   // обработка null для старых версий IE
   if (elem === null) {
      return 'null';
   }

   // обработка DOM-элементов
   if (elem && (elem.nodeType === 1 || elem.nodeType === 9)) {
      return 'element';
   }

   var regexp = /\[object (.*?)\]/,
      match = Object.prototype.toString.call(elem).match(regexp),
      type = match[1].toLowerCase();

   // обработка NaN и Infinity
   if (type === 'number') {
      if (isNaN(elem)) {
         return 'nan';
      }
      if (!isFinite(elem)) {
         return 'infinity';
      }
   }

   return type;
}

//Копипаста из sbis3-genie/.../i18nGenerator.js
function merge(hash, hashExtender, cfg) {
   if (cfg === undefined) {
      cfg = {};
   }
   cfg.preferSource = cfg.preferSource !== undefined ? cfg.preferSource : false; // не сохранять исходное значение
   cfg.rec = cfg.rec !== undefined ? cfg.rec : true;  // объединять рекурсивно
   cfg.clone = cfg.clone !== undefined ? cfg.clone : false; // не клонировать элементы (передаем по ссылке)
   cfg.create = cfg.create !== undefined ? cfg.create : true; // создавать элементы, которых нет в исходном хэше
   cfg.noOverrideByNull = cfg.noOverrideByNull !== undefined ? cfg.noOverrideByNull : false; // не заменять значения null'овыми

   var cloneOrCopy = function(i) {
      /**
       * Если к нам пришел объект и можно клонировать
       * Запускаем мерж того, что пришло с пустым объектом (клонируем ссылочные типы).
       */
      if ((typeof (hashExtender[i]) == 'object' && hashExtender[i] !== null) && cfg.clone) {
         hash[i] = merge(helperType(hashExtender[i]) === 'array' ? [] : {}, hashExtender[i], cfg);
      }

      /**
       * Иначе (т.е. это
       *  ... не объект (простой тип) или
       *  ... запрещено клонирование)
       *
       * Если к нам пришел null и запрещено им заменять - не копируем.
       */
      else if (!(hashExtender[i] === null && cfg.noOverrideByNull)) {
         hash[i] = hashExtender[i];
      }
   };

   if (typeof (hash) == 'object' && hash !== null && typeof (hashExtender) == 'object' && hashExtender !== null) {
      for (var i in hashExtender) {
         if (hashExtender.hasOwnProperty(i)) {
            // Если индекса в исходном хэше нет и можно создавать
            if (hash[i] === undefined) {
               if (cfg.create) {
                  if (hashExtender[i] === null) {
                     hash[i] = null;
                  } else {
                     cloneOrCopy(i);
                  }
               }
            } else if (!cfg.preferSource) { // Индекс есть, исходное значение можно перебивать
               if (hash[i] && typeof hash[i] == 'object' && typeof hashExtender[i] == 'object') {
                  // Объект в объект
                  if (helperType(hash[i]) === 'date') {
                     if (helperType(hashExtender[i]) === 'date') {
                        hash[i] = cfg.clone ? new Date(+hashExtender[i]) : hashExtender[i];
                        continue;
                     }
                     hash[i] = helperType(hashExtender[i]) === 'array' ? [] : {};
                  } else {
                     if (helperType(hashExtender[i]) === 'date') {
                        hash[i] = cfg.clone ? new Date(+hashExtender[i]) : hashExtender[i];
                        continue;
                     }
                  }
                  hash[i] = cfg.rec ? merge(hash[i], hashExtender[i], cfg) : hashExtender[i];
               } else // Перебиваем что-то в что-то другое...
               {
                  cloneOrCopy(i);
               }
            }

            /**
             * Исходное значение имеет приоритет, но разрешена рекурсия
             * Идем глубже.
             */
            else if (typeof hash[i] == 'object' && typeof hashExtender[i] == 'object' && cfg.rec) {
               hash[i] = merge(hash[i], hashExtender[i], cfg);
            }
         }
      }
   } else if (!(hashExtender === null && cfg.noOverrideByNull) && !cfg.preferSource) {
      hash = hashExtender;
   }

   return hash;
}

//Очередь.
//json-generator умеет паралелить генерацию на два jsDocWorker.
//Но он не умеет очередь. Ему нельзя давать больше двух задач за раз.
//Т.о. образом очередь должна быть внешней по отношению к генератору.
//Родная очередь - sbis3-genie/.../jsonIndex.js на основе async.js, а это типа костыль.
var queue = {
   workerCount: 2,
   freeWorkers: 2,
   tasks: [],

   //Функция, обрабатывающая задачи
   workFunc: null,

   //колбэк на опустошение очереди
   onEmpty: null,

   next: function() {
      if (this.tasks.length === 0) {
         this.freeWorkers += 1;

         if (this.freeWorkers == this.workerCount) {
            this.onEmpty();
         }

         return;
      }

      var task = this.tasks.pop();
      this.workFunc(task, function() {
         this.next();
      }.bind(this));
   },

   //Создает новую задачу
   task: function(taskId, mapping) {
      console.log('task');
      console.log('taskId: ', taskId);
      console.log('mapping: ', JSON.stringify(mapping));
      this.tasks.push({
         taskId: taskId,
         mapping: mapping,
         count: 0 //попыток обработки
      });
      if (this.freeWorkers > 0) {
         this.freeWorkers -= 1;
         this.next();
      }
   },

   repeat: function(task) {
      task.count++;
      this.tasks.push(task);
   }
};

var jsonIndex = {
   fileJson: {},
   modules: {},
   classes: {},

   getByName: function(name) {
      if (!jsonIndex.classes[name]) {
         //console.log('Class', name, 'not found');
      }
      return jsonIndex.classes[name];
   },

   getClassPack: function(className) {
      var augmentNames = [];
      this._augmentsOf(className, augmentNames);

      return [className].concat(augmentNames).map(jsonIndex.getByName);
   },

   _augmentsOf: function(className, res) {
      var classJson = this.classes[className];
      if (!classJson) {
         return;
      }
      var augments = this.classes[className].augments || [];
      augments.forEach(function(name) {
         if (res.indexOf(name) == -1) {
            res.push(name);
         }
         jsonIndex._augmentsOf(name, res);
      });
   }
};

function loadJson(jsonFile) {
   try {
      var json = JSON.parse(fs.readFileSync(jsonFile).toString());
   } catch (e) {
      console.log('[ERROR]', jsonFile, e);
      throw e;
   }

   //console.log('LOAD JSON', json.className, jsonFile, json.fullname);
   jsonIndex.classes[json.className] = json;
}

var Cache = {
   index: {
      units: {}
   },
   _indexFileName: '',

   _toUnit: function(mapping) {
      var files = mapping.map(function(m) {
         return m.from;
      });
      var mainFile = files[0];

      return {
         id: mainFile
      };
   },

   get: function(mapping) {
      var unit = this._toUnit(mapping);
      return this.index.units[unit.id];
   },

   set: function(mapping, jsonFullFiles, filesModules) {
      var unit = this._toUnit(mapping);

      unit.files = {};

      for (var f in jsonFullFiles) {
         if (jsonFullFiles.hasOwnProperty(f)) {
            unit.files[f] = {
               jsonFiles: jsonFullFiles[f],
               mtime: fs.statSync(f).mtime
            };
         }
      }
      for (var f in filesModules) {
         if (filesModules.hasOwnProperty(f)) {
            if (!unit.files[f]) {
               unit.files[f] = {
                  mtime: fs.statSync(f).mtime
               };
            }
            unit.files[f].module = filesModules[f];
         }
      }

      this.index.units[unit.id] = unit;
   },

   load: function() {
      this._indexFileName = path.join(jsonTempDir, 'cache-index.json');
      if (fs.existsSync(this._indexFileName)) {
         var content = fs.readFileSync(this._indexFileName);
         try {
            this.index = JSON.parse(content);
         } catch (e) {
         }
      }

      this._deleteOldUnits();
   },

   _deleteOldUnits: function() {
      var checkedUnits = {};

      Object.keys(this.index.units).forEach(function(id) {
         var unit = this.index.units[id];
         for (var f in unit.files) {
            if (unit.files.hasOwnProperty(f)) {
               if (!fs.existsSync(f)) {
                  return;
               } //Файла больше нет

               var
                  mtime1 = JSON.stringify(fs.statSync(f).mtime),
                  mtime2 = JSON.stringify(unit.files[f].mtime);

               if (mtime1 != mtime2) {
                  console.log('OLD', unit.id);
                  return; //Файл новее записи в кеше
               }
            }
         }
         checkedUnits[unit.id] = unit;
      }.bind(this));

      this.index.units = checkedUnits;
   },

   store: function() {
      console.log('store', this._indexFileName);
      fs.writeFileSync(this._indexFileName, JSON.stringify(this.index, null, '   '));
   },

   extract: function(cache) {
      var
         jsonFullFiles = {},
         filesModules = {};

      Object.keys(cache.files).forEach(function(fileName) {
         var file = cache.files[fileName];
         filesModules[fileName] = file.module;
         jsonFullFiles[fileName] = file.jsonFiles || [];
      });

      return {
         jsonFullFiles: jsonFullFiles,
         filesModules: filesModules
      };
   }
};

queue.workFunc = function(task, done) {
   var cache = Cache.get(task.mapping);
   if (cache) {
      var c = Cache.extract(cache);
      setImmediate(function() {
         onJson(c.jsonFullFiles, c.filesModules);
      }, 0);
   } else {
      sbis3JsonGenerator.generateJson(task.mapping, function(code, jsonFullFiles, filesModules, failedFiles) {
         //jsonFullFiles - {originFile: jsonFile}
         //filesModules - {fileName: moduleName}

         console.log('DONE sbis3JsonGenerator.generateJson\n',
            'code', code, '\n',
            'jsonFullFiles', jsonFullFiles, '\n',
            'filesModules', filesModules, '\n',
            'failedFiles', failedFiles, '\n');

         Cache.set(task.mapping, jsonFullFiles, filesModules);

         onJson(jsonFullFiles, filesModules);
      }, {showStdout: false});
   }

   function onJson(jsonFullFiles, filesModules) {
      for (var file in jsonFullFiles) {
         var jsonFiles = jsonFullFiles[file];
         jsonIndex[file] = jsonFiles;

         var repeat = false;

         try {
            jsonFiles.forEach(loadJson);
         } catch (e) {
            // https://inside.tensor.ru/opendoc.html?guid=c762cdd1-8e13-4ed8-9aae-d497734f965b
            // https://inside.tensor.ru/opendoc.html?guid=f5a16f12-9048-4012-9b82-29a75d8644c7
            //Падала сборка из-за кривого json-а, точные причины не понятны:
            // * локально не повторить;
            // * сборщики затрудняются найти файл, на который ссылкается лог генератора.
            //По единственному полученому файлу, можно сделать вывод,
            // что он был одноврменно паралельно записан разными процессами (это вообще возможно? nodejs такой nodejs).
            //Поэтому найдя файл, при чтении которого получаем "невозможный" SyntaxError повторим генерацию для этой задачи.
            //Но только один раз. Если повторяется и второй раз, то проблема серьезнее, чем кажется. В такм случае всё-же надо падать.

            repeat = e.name == 'SyntaxError' && task.count == 0;
            if (!repeat) {
               throw e;
            }
         }

         if (repeat) {
            console.log('Repeat of', task.mapping[0].from);
            queue.repeat(task);

            done();
            return;
         }
      }

      for (var file in filesModules) {
         jsonIndex.modules[filesModules[file]] = file;
      }

      ProgressStatus.taskDone(task.taskId);
      done();
   }
};

function cloneObject(object) {
   if (object instanceof Array) {
      return object.map(cloneObject);
   }

   if (object === null || typeof object != 'object') {
      return object;
   }

   var clonedObject = {};
   var keys = Object.keys(object);
   keys.forEach(function(key) {
      clonedObject[key] = cloneObject(object[key]);
   });
   return clonedObject;
}

queue.onEmpty = function() {
   //sbis3JsonGenerator.stop();
   console.log('All json generated, now merging', new Date());

   ProgressStatus.log(100, 'Final json merging');

   for (var className in jsonIndex.classes) {
      var classJson = jsonIndex.classes[className];
      var classes = jsonIndex.getClassPack(className);

      var
         resultClass = {};
      classes.forEach(function(classJson) {
         if (!classJson) {
            //У предка нет json-а. Значит примерживать нечего
            return;
         }

         //merge портит (и возвращает) первый аргумент.
         //Менять аргументы местами нельзя - все ломается.
         resultClass = merge(cloneObject(classJson), resultClass);
      });

      var
         name = classJson.fullname || classJson.name,
         jsonDir = path.join(outputDir, path.dirname(name)),
         jsonFile = path.join(jsonDir, path.basename(name) + '.json');

      mkdirp.sync(jsonDir);
      fs.writeFileSync(jsonFile, JSON.stringify(resultClass, null, 3));
   }

   Cache.store();

   console.log('End', new Date());
   process.exit();
};

console.log('Start', new Date());
console.log('Input:', dirs);

ProgressStatus.log(0, 'Cache initializing');
Cache.load();

ProgressStatus.log(0, 'Collect files to generating. Directories count: ' + dirs.length);

dirs.forEach((dir) => {
   dir = dir.replace(/\\/g, '/').replace(/\/$/, '');

   const fileList = sbis3JsonGenerator.getFilesForGenerating(dir);
   const moduleName = path.basename(dir);

   ProgressStatus.newTask();
   queue.task(moduleName, fileList.map(fileName => {
      return {
         from: fileName,
         out: path.join(jsonTempDir, fileName.slice(2))
      };
   }));


});
