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
   async = require('async'),
   util = require('util'),
   grunt;

// Speed up calls to hasOwnProperty
var hasOwnProperty = Object.prototype.hasOwnProperty;

var
   isModule = /\.module\.js$/,
   fromResources = new RegExp('resources' + path.sep + 'w');

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
   return filename.indexOf(moduleName) !== -1 || fromResources.test(filename);
}


/**
 * Constructor
 * @param g {Object} - grunt
 * @param options {Object} - options
 * @constructor
 */
function Packer(g, options) {
   grunt = g;

   /**
    * Application root
    */
   this._serviceRoot = path.join(process.env.ROOT, options.application);
   this._resources = path.join(this._serviceRoot, options.resources);
   /**
    * contents.js
    */
   this._contents = require(path.join(this._resources, 'contents.json'));
   //this._dependencies = require(path.join(this._resources, 'module-dependencies.json'));
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
         grunt.log.error(util.format('%d | %s | Exception has occurred while processing: ',
            process.pid,
            grunt.template.today('hh:MM:ss'),
            err
         ));

         process.exit(-5);
      } else {

         cb();
      }
   }

   function over(err) {
      if (err) {
         // something unexpected has happened
         grunt.log.error(util.format('%d | %s | Exception has occurred while processing: ',
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

         try {
            grunt.file.write(path.join(self._resources, 'contents.js'), 'var contents = ' + JSON.stringify(self._contents));
            grunt.file.write(path.join(self._resources, 'contents.json'), JSON.stringify(self._contents));
            cb(self._contents);
         } catch(err) {
            grunt.log.error(util.format('%d | %s | Packer couldn\'t write the result to either contents.js or contents.json file.',
               process.pid,
               grunt.template.today('hh:MM:ss'),
               err
            ));

            process.exit(-5);
         }
      }
   }
};

Packer.prototype._followTheFirstPrinciple = function (type, filename, moduleName, cb) {
   throw new Error('Not implemented yet!');
};

Packer.prototype._followTheSecondPrinciple = function (type, filename, moduleName, cb) {
   var
      self = this,
      file = path.join(self._resources, filename),
      files = [];

   var
      destination = path.join(self._resources, moduleName);

   // select files to shift by name
   // investigate the module's directory
   grunt.file.recurse(path.dirname(file), function(abspath, rootdir, subdir, name) {
      subdir = subdir || '/';

      // firstly, check if it is module's dependency
      if(belongs(path.join(subdir, name), path.basename(filename, '.js'))) {
         files.push({
            abspath: abspath,
            subdir: subdir,
            name: name
         });
      }
   });

   self._shift(moduleName, filename, files, destination, self._update);
};

Packer.prototype._shift = function (moduleName, filename, files, destination, cb) {
   var
      deleteOptions = {
         force: true
      };

   files.forEach(function(file) {
      var
         newFile = path.join(destination, file.subdir, file.name);

      try {
         grunt.file.copy(file.abspath, newFile);
         grunt.file.delete(file.abspath, deleteOptions);
      } catch(err) {
         cb(err);

         return;
      }
   });

   cb();
};

/**
 * Cuts the module path from contents file
 * @param type {String} - type
 * @param moduleName {String} - module name in contents file
 * @param cb {Function} - callback
 * @private
 */
Packer.prototype._update = function (err, type, moduleName, cb) {
   if (err) {
      cb(err);
   } else {
      grunt.log.debug(util.format('%d | %s | Module %s has been shifted',
         process.pid,
         grunt.template.today('hh:MM:ss'),
         moduleName
      ));

      this._contents[type][moduleName] = '';

      cb();
   }
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