var
   wsPath = process.env.WS,
   uiModulesList = process.env.INPUT,
   cloudPath = process.env.CLOUD,
   outputDir = process.env.OUTPUT;

var
   mkdirp = require('mkdirp'),
   sbis3JsonGenerator = require('sbis3-json-generator/genieInterface'),
   path = require('path'),
   fs = require('fs');

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
   }
});

var
   dirs = JSON.parse(fs.readFileSync(uiModulesList).toString()),
   jsonTempDir = path.join(path.dirname(outputDir), 'json-gen-temp');

if(wsPath){
   dirs.unshift(wsPath);
}

mkdirp.sync(jsonTempDir);

dirs = dirs.filter(function(d){
   return fs.existsSync(d);
});

var ProgressStatus = {
   queuedTaskCount: 0,
   doneTaskCount: 0,
   lastPercent: 0,
   prevTaskId: null,
   lastTaskId: null,

   newTask: function(){
      this.queuedTaskCount ++;
   },

   taskDone: function(taskId){
      this.doneTaskCount ++;

      var newPercent;
      if(this.queuedTaskCount)
         newPercent = Math.floor( this.doneTaskCount * 100 / this.queuedTaskCount );
      else
         newPercent = 0;

      //"анти-дребезг": из-за двупоточности на границе меж модулями может проскочить старый. Избавимся от этого.
      if(taskId == this.prevTaskId){
         taskId = this.lastTaskId;
      }

      if(newPercent > this.lastPercent || taskId != this.lastTaskId){
         this.lastPercent = newPercent;
         if(taskId != this.lastTaskId) {
            this.prevTaskId = this.lastTaskId;
            this.lastTaskId = taskId;
         }
         this.log(newPercent, taskId);
      }
   },

   log: function(percent, msg){
      console.log('[' + percent + '%]generateJson ' + msg);
   }
};

//Копипаста из sbis3-genie/.../i18nGenerator.js
function helperType(elem) {
   // обработка null для старых версий IE
   if (elem === null)
      return 'null';

   // обработка DOM-элементов
   if (elem && (elem.nodeType === 1 || elem.nodeType === 9))
      return 'element';

   var regexp = /\[object (.*?)\]/,
      match = Object.prototype.toString.call(elem).match(regexp),
      type = match[1].toLowerCase();

   // обработка NaN и Infinity
   if (type === 'number') {
      if (isNaN(elem))
         return 'nan';
      if (!isFinite(elem))
         return 'infinity';
   }

   return type;
}

//Копипаста из sbis3-genie/.../i18nGenerator.js
function merge(hash, hashExtender, cfg){
   if (cfg === undefined)
      cfg = {};
   cfg.preferSource = cfg.preferSource !== undefined ? cfg.preferSource : false; // не сохранять исходное значение
   cfg.rec = cfg.rec !== undefined ? cfg.rec : true;  // объединять рекурсивно
   cfg.clone = cfg.clone !== undefined ? cfg.clone : false; // не клонировать элементы (передаем по ссылке)
   cfg.create = cfg.create !== undefined ? cfg.create : true; // создавать элементы, которых нет в исходном хэше
   cfg.noOverrideByNull = cfg.noOverrideByNull  !== undefined ? cfg.noOverrideByNull : false; // не заменять значения null'овыми

   var cloneOrCopy = function(i){
      /**
       * Если к нам пришел объект и можно клонировать
       * Запускаем мерж того, что пришло с пустым объектом (клонируем ссылочные типы).
       */
      if ((typeof(hashExtender[i]) == 'object' && hashExtender[i] !== null) && cfg.clone)
         hash[i] = merge(helperType(hashExtender[i]) === 'array' ? [] : {}, hashExtender[i], cfg);
      /**
       * Иначе (т.е. это
       *  ... не объект (простой тип) или
       *  ... запрещено клонирование)
       *
       * Если к нам пришел null и запрещено им заменять - не копируем.
       */
      else if(!(hashExtender[i] === null && cfg.noOverrideByNull))
         hash[i] = hashExtender[i];
   };

   if(typeof(hash) == 'object' && hash !== null && typeof(hashExtender) == 'object' && hashExtender !== null){
      for (var i in hashExtender){
         if (hashExtender.hasOwnProperty(i)){
            // Если индекса в исходном хэше нет и можно создавать
            if (hash[i] === undefined) {
               if(cfg.create) {
                  if(hashExtender[i] === null)
                     hash[i] = null;
                  else
                     cloneOrCopy(i);
               }
            }
            else if (!cfg.preferSource){ // Индекс есть, исходное значение можно перебивать
               if (hash[i] && typeof hash[i] == 'object' && typeof hashExtender[i] == 'object') {
                  // Объект в объект
                  if(helperType(hash[i]) === 'date') {
                     if(helperType(hashExtender[i]) === 'date') {
                        hash[i] = cfg.clone ? new Date(+hashExtender[i]) : hashExtender[i];
                        continue;
                     }
                     hash[i] = helperType(hashExtender[i]) === 'array' ? [] : {};
                  } else {
                     if(helperType(hashExtender[i]) === 'date') {
                        hash[i] = cfg.clone ? new Date(+hashExtender[i]) : hashExtender[i];
                        continue;
                     }
                  }
                  hash[i] = cfg.rec ? merge(hash[i], hashExtender[i], cfg) : hashExtender[i];
               }
               else // Перебиваем что-то в что-то другое...
                  cloneOrCopy(i);
            }
            /**
             * Исходное значение имеет приоритет, но разрешена рекурсия
             * Идем глубже.
             */
            else if (typeof hash[i] == 'object' && typeof hashExtender[i] == 'object' && cfg.rec)
               hash[i] = merge(hash[i], hashExtender[i], cfg);
         }
      }
   }
   else if(!(hashExtender === null && cfg.noOverrideByNull) && !cfg.preferSource)
      hash = hashExtender;

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

   next: function(){
      if(this.tasks.length === 0){
         this.freeWorkers += 1;

         if(this.freeWorkers == this.workerCount){
            this.onEmpty();
         }

         return;
      }

      var task = this.tasks.pop();
      this.workFunc(task.taskId, task.mapping, function(){
         this.next();
      }.bind(this));
   },

   //Создает новую задачу
   task: function(taskId, mapping){
      this.tasks.push({
         taskId: taskId,
         mapping: mapping
      });
      if(this.freeWorkers > 0){
         this.freeWorkers -= 1;
         this.next();
      }
   }
};

var jsonIndex = {
   fileJson: {},
   modules: {},
   classes: {},

   getByName: function(name){
      if(!jsonIndex.classes[name]){
         console.log('Class', name, 'not found');
      }
      return jsonIndex.classes[name];
   },

   getClassPack: function(className){
      var augmentNames = [];
      this._augmentsOf(className, augmentNames);

      return [className].concat(augmentNames).map(jsonIndex.getByName);
   },

   _augmentsOf: function(className, res){
      var classJson = this.classes[className];
      if(!classJson){
         return;
      }
      var augments = this.classes[className].augments || [];
      augments.forEach(function(name){
         if(res.indexOf(name) == -1){
            res.push(name);
         }
         jsonIndex._augmentsOf(name, res);
      });
   }
};

function loadJson(jsonFile){
   try{
      var json = JSON.parse(fs.readFileSync(jsonFile).toString());
   } catch(e){
      console.log('ERROR', e);
      //return;
      throw e;
   }

   //console.log('LOAD JSON', json.className, jsonFile, json.fullname);
   jsonIndex.classes[json.className] = json;
}

queue.workFunc = function(taskId, mapping, done){
   sbis3JsonGenerator.generateJson(mapping, function(code, jsonFullFiles, filesModules, failedFiles){
      //jsonFullFiles - {originFile: jsonFile}
      //filesModules - {fileName: moduleName}

      done();
      ProgressStatus.taskDone(taskId);

      //console['log']('DONE jsonGeneratorWorker for', '\njsonFullFiles', jsonFullFiles, '\nfilesModules', filesModules, '\ncode', code);

      for(var file in jsonFullFiles){
         var jsonFiles = jsonFullFiles[file];
         jsonIndex[file] = jsonFiles;

         jsonFiles.forEach(loadJson);
      }

      for(var file in filesModules){
         jsonIndex.modules[filesModules[file]] = file;
      }
   }, {showStdout: false});
};

function cloneObject(object){
   if(object instanceof Array){
      return object.map(cloneObject);
   }

   if(object === null || typeof object != 'object'){
      return object;
   }

   var clonedObject = {};
   var keys = Object.keys(object);
   keys.forEach(function(key){
      clonedObject[key] = cloneObject(object[key]);
   });
   return clonedObject;
}

queue.onEmpty = function(){
   //sbis3JsonGenerator.stop();
   console.log('All json generated, now merging', new Date());

   ProgressStatus.log(100, 'Final json merging');

   for(var className in jsonIndex.classes){
      var classJson = jsonIndex.classes[className];
      var classes = jsonIndex.getClassPack(className);

      var
         resultClass = {};
      classes.forEach(function(classJson){
         if(!classJson){
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

   console.log('End', new Date());
   process.exit();
};

console.log('Start', new Date());

ProgressStatus.log(0, 'Collect files to generating');
sbis3JsonGenerator.getFilesForGeneratingAsyncList(dirs, function(fileList){
   //fileList = [{moduleFile: '*.module.js', additionalFiles: ['*.js']}]

   dirs = dirs.map(function(d){
      return d.replace(/\\/g, '/');
   });

   fileList.forEach(function(fileItem){
      var module = dirs.filter(function(d){
         return fileItem.moduleFile.indexOf(d) == 0;
      })[0] || fileItem.moduleFile;
      module = module.split('/').pop();

      ProgressStatus.newTask();
      queue.task(module, fileItem.additionalFiles.concat([fileItem.moduleFile]).map(function(fileName){
         return {
            from: fileName,
            out: path.join(jsonTempDir, fileName.slice(2))
         };
      }));
   });
});
