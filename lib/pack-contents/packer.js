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

'use strict';

var
   path = require('path'),
   async = require('async'),
   util = require('util'),
   esprima = require('esprima'),
   traverse = require('estraverse').traverse,
   grunt;

// Speed up calls to hasOwnProperty
var hasOwnProperty = Object.prototype.hasOwnProperty;

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
 * @param moduleName {String} - current module name
 * @param initialModuleName {String} - initial module name
 * @returns {boolean}
 */
function belongs(moduleName, initialModuleName) {
   var
      definitions = moduleName.split('!'),
      prefix = definitions[0],
      name = definitions[1],
      pathSep = /[/\\]/;

   if (name && name.split(pathSep)[0] === initialModuleName) {
      return true;
   } else if (this._contents[name]) {
      // this is another module
      return false;
   } else {
      return false;
   }
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
   this._originals = {};
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
      self._originals[type] = {};
      // add to collection
      tasks.push(function(cb) {
         // self._contents[type] is an object
         async.forEachOf(self._contents[type], iteratee.bind(self, type), overEach.bind(self, type, cb));
      });
   });

   // measure time
   this._started = Date.now();

   // call one by one
   async.series(tasks, over);

   function iteratee(type, filename, moduleName, cb) {
      switch (type) {
         // TODO other types
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
            grunt.file.write(path.join(self._resources, 'contents.js'), 'var contents = ' + JSON.stringify(self._contents, null, 3));
            grunt.file.write(path.join(self._resources, 'contents.json'), JSON.stringify(self._contents, null, 3));
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
      fileContent = grunt.file.read(path.join(self._resources, filename)),
      packet = [],
      destination = path.join(this._resources, moduleName);

   packet.push(['js', moduleName].join('!'));

   // select files to shift by name
   traverse(esprima.parse(fileContent), {
      enter: function (node) {
         if (node.type === 'CallExpression' && node.callee && node.callee.name === 'define') {
            if(node.arguments && node.arguments[1] && node.arguments[1].type === 'ArrayExpression') {
               var dependencies = node.arguments[1].elements;

               dependencies.forEach(function(d, i) {
                  if(d.value && belongs.call(self, d.value, moduleName)) {
                     packet.push(d.value);
                  }
               });
            }
         }
      }
   });

   self._shift(type, filename, moduleName, packet, destination, cb);
};

Packer.prototype._shift = function (type, filename, moduleName, packet, destination, cb) {
   var
      basename = path.basename(filename, '.module.js'),
      moduleDir = path.dirname(path.join(this._resources, filename));

   grunt.log.debug(util.format('%d | %s | Shifting module %s (%s): %j',
      process.pid,
      grunt.template.today('hh:MM:ss'),
      moduleName,
      filename,
      packet
   ));

   packet.forEach(function(d) {
      var
         definitions = d.split('!'),
         prefix = definitions[0],
         name = definitions[1],
         incomingName = basename,
         outgoingName = moduleName,
         relativePath = name.replace(moduleName, '');

      switch (prefix) {
         case 'js':
            relativePath = relativePath ? [relativePath, 'js'].join('.') : '';
            incomingName += relativePath ? '.js' : '.module.js';
            outgoingName += relativePath ? '.js' : '.module.js';

            grunt.file.copy(path.join(moduleDir, relativePath || incomingName), path.join(destination, outgoingName));

            break;
         case 'css':
            relativePath = relativePath ? [relativePath, 'css'].join('.') : '';
            incomingName += '.css';
            outgoingName += '.css';

            grunt.file.copy(path.join(moduleDir, relativePath || incomingName), path.join(destination, outgoingName));

            break;
         case 'html':
            relativePath = relativePath ? [relativePath, 'xhtml'].join('.') : '';
            incomingName += '.xhtml';
            outgoingName += '.xhtml';

            grunt.file.copy(path.join(moduleDir, relativePath || incomingName), path.join(destination, outgoingName));

            break;
      }
   });

   this._update(null, type, moduleName, cb);
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
      this._originals[type][moduleName] = this._contents[type][moduleName];
      this._contents[type][moduleName] = '';

      cb();
   }
};

Packer.prototype._cleanup = function() {
   // TODO
};

Packer.prototype.run = function (cb) {
   // run task
   this._sort(cb);
};

/**
 * Exports class
 * @type {Packer}
 */
module.exports = Packer;