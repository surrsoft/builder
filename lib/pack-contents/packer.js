/**
 * Фасовщик файлов
 */

/**
 * Описание принципов:
 *
 * 1 htmlNames FIXME: НЕРЕАЛИЗОВАНО!
 * js!SBIS3.BUH.Acquiring.Accounts.Registry.WithdrawalDialog: "WithdrawalDialog.html"
 * Если последняя часть (начиная от последней точки и до конца) названия модуля совпадает с именем файла (без расширения),
 * то такой файл помещается в ресурсы по пути, где каждая точка в названии модуля соответсвует новой вложенной директории.
 * Имя файла остается неизменным, как и расширение:
 * {{=root}}/resources/SBIS3/BUH/Acquiring/Accounts/Registry/WithdrawalDialog/WithdrawalDialog.html
 * Преффикс js! опускается
 *
 * 2 jsModules
 * SBIS3.AccessControl.SmartCard: "/resources/AccessControl/SmartCard/SmartCard.module.js"
 * Модуль SmartCard.module.js помещается в папку SBIS3.AccessControl.SmartCard
 * Если имя файла отличается от названия в левой части как:
 * SBIS3.ACCOUNT.AnalytInit: "/resources/Buhgalteriya-onlajn/AccountCfgNavigation.module.js",
 * то такой файл переименовывается в AnalytInit.module.js и помещается в папку SBIS3.ACCOUNT.AnalytInit
 */

'use strcit';

var
   path = require('path'),
   fs = require('fs'),
   async = require('async'),
   mkdirp = require('mkdirp'),
   util = require('util'),
   grunt;

// Speed up calls to hasOwnProperty
var hasOwnProperty = Object.prototype.hasOwnProperty;

var isModule = /\.module\.js$/;

function isEmpty(obj) {
   // null and undefined are "empty"
   if (obj == null) return true;

   // Assume if it has a length property with a non-zero value
   // that that property is correct.
   if (obj.length > 0)    return false;
   if (obj.length === 0)  return true;

   // Otherwise, does it have any properties of its own?
   // Note that this doesn't handle
   // toString and valueOf enumeration bugs in IE < 9
   for (var key in obj) {
      if (hasOwnProperty.call(obj, key)) return false;
   }

   return true;
}

/**
 * Checks whether file belongs to specified module
 * @param filename
 * @param moduleName
 * @returns {boolean}
 */
function belongs(filename, moduleName) {
   return filename.indexOf(moduleName) !== -1;
}

function addExtname(filename) {
   if(isModule.test(filename)) {
      return '.module.js';
   } else {
      return path.extname(filename);
   }
}

function Packer(g, options) {
   grunt = g;

   /**
    * Application root
    */
   this._serviceRoot = options.application;
   this._resources = options.resources;
   /**
    * contents.js
    */
   this._contents = require(path.join(this._resources, 'contents.json'));
   this._dependencies = require(path.join(this._resources, 'module-dependencies.json'));
}

Packer.prototype._sort = function (cb) {
   var
      self = this,
      tasks = [],
      /**
       * htmlNames
       * jsModules
       * modules
       * services
       * xmlContents
       * xmlPackages
       */
      types = Object.keys(this._contents);

   // create tasks collection
   types.forEach(function(type) {
      // add to collection
      tasks.push(function(cb) {
         // self._contents[type] is an object
         async.forEachOf(self._contents[type], iteratee.bind(self, type), overEach.bind(self, type, cb));
      });
   });

   // call one by one
   async.series(tasks, over);

   function iteratee(type, filename, moduleName, cb) {
      switch (type) {
         // TODO other types
         //...
         case 'jsModules':
            self._followTheSecondPrinciple(type, filename, moduleName, cb);
            break;
         default:
            cb();
            break;
      }
   }

   function overEach(type, cb, err) {
      if (err) {
         // something unexpected has happened
         grunt.log.error(util.format('%d | %s | Uncaught exception has occurred while processing: ',
            process.pid,
            grunt.template.today('hh:MM:ss'),
            err
         ));

         process.exit(-5);
      } else {
         var
            amount = self._contents[type] ? Object.keys(self._contents[type]).length : 0;

         grunt.log.ok(util.format('%d | %s | %d modules has been left for type %s',
            process.pid,
            grunt.template.today('hh:MM:ss'),
            amount,
            type
         ));

         cb();
      }
   }

   function over(err) {
      if (err) {
         // something unexpected has happened
         grunt.log.error(util.format('%d | %s | Uncaught exception has occurred while processing: ',
            process.pid,
            grunt.template.today('hh:MM:ss'),
            err
         ));

         process.exit(-5);
      } else {
         grunt.log.ok(util.format('%d | %s | Packer has finished his work successfully. Taken time: %dms',
            process.pid,
            grunt.template.today('hh:MM:ss'),
            Date.now() - self._started
         ));

         var tasks = [
            function (cb) {
               fs.writeFile(path.join(this._serviceRoot, this._resources, 'contents.js'), 'var contents = ' + JSON.stringify(self._contents), cb);
            },
            function (cb) {
               fs.writeFile(path.join(this._serviceRoot, this._resources, 'contents.json'), JSON.stringify(self._contents), cb);
            }
         ];

         async.parallel(tasks, function(err) {
            if(err) {
               grunt.log.error(util.format('%d | %s | Packer couldn\'t write the result to either contents.js or contents.json file.',
                  process.pid,
                  grunt.template.today('hh:MM:ss'),
                  err
               ));

               process.exit(-5);
            } else {
               cb(self._contents);
            }
         });
      }
   }
};

Packer.prototype._followTheFirstPrinciple = function (type, filename, moduleName, cb) {
   throw new Error('Not implemented yet!');
};

Packer.prototype._followTheSecondPrinciple = function (type, filename, moduleName, cb) {
   var
      self = this,
      resources = path.join(self._serviceRoot, 'resources'),
      file = path.join(resources, filename),
      files = [],
      links = self._dependencies.links['js!'.concat(moduleName)],
      destination = path.join(resources, moduleName);

   // select files to shift by name
   links && links.forEach(function(link) {
      if(belongs(link, moduleName)) {
         var node = self._dependencies.nodes[link];

         if(node) {
            files.push(path.join(self._serviceRoot, node.path));
         }
      }
   });

   // add module.js file
   files.unshift(file);

   self._shift(moduleName, files, destination, afterShift);

   function afterShift(err) {
      if (err) {
         grunt.log.error(util.format('%d | %s | Error has occurred while shifting module %s: ',
            process.pid,
            grunt.template.today('hh:MM:ss'),
            moduleName,
            err
         ));

         cb(err);
      } else {
         self._update(type, moduleName, cb);
      }
   }
};

Packer.prototype._shift = function (moduleName, files, destination, cb) {
   mkdirp(destination, async.each.bind(async, files, move, cb));

   function move(file, cb) {
      var newPath = path.join(destination, moduleName + addExtname(file));

      fs.rename(file, newPath, function (err) {
         if (err) {
            cb(err);
         } else {
            // unlink old path
            fs.unlink(destination, cb);
         }
      });
   }
};

Packer.prototype._update = function (type, moduleName, cb) {
   if (this._contents[type] && !isEmpty(this._contents[type])) {
      delete this._contents[type][moduleName];
   } else {
      grunt.log.ok(util.dormat('%d | %s | Type %s is empty!',
         process.pid,
         grunt.template.today('hh:MM:ss'),
         type
      ));

      delete this._contents[type];
   }

   cb();
};

Packer.prototype.run = function (cb) {
   // measure time
   this._started = Date.now();
   // run task
   this._sort(cb);
};

/**
 * Exports class
 * @type {Packer}
 */
module.exports = Packer;