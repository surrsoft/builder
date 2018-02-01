'use strict';

const fs                    = require('fs');
const path                  = require('path');
const through2              = require('through2');
const gutil                 = require('gulp-util');
const nlog                  = require('../lib/logger-native');
const PluginError           = gutil.PluginError;
const VFile                 = require('vinyl');
const argv                  = require('yargs').argv;
const glob                  = require('glob');
const assign                = require('object-assign');
const DepGraph              = require('grunt-wsmod-packer/lib/dependencyGraph');
DepGraph.prototype.markNodeAsAMD = function(v) {
   if (this._nodes[v]) {
      this._nodes[v].amd = true;
   }
};

const translit              = require('../lib/transliterate');
const removeLeadingSlash    = function removeLeadingSlash(path) {
   if (path) {
      var head = path.charAt(0);
      if (head == '/' || head == '\\') {
         path = path.substr(1);
      }
   }
   return path;
};

/*
    1. Инициализация манифестов (нужны для инкрментальной сборки)
        1.1 contents.{json,js}
        1.2 module-dependencies.json
        1.3 deanonymizeData.json
        1.4 routes-info.json
        1.5 packwsmod.json
        1.6 packwsmodContents.json (в нем хранятся исходные состояния html-файлов, которые располагаются рядом с папкой resources)
        1.7 packjscss.json (содержит дерево зависимостей пакетов тасок packjs и packcss)
        1.8 custompack.json (содержит дерево зависимостей пакетов таски custompack)
    2. Инициализация графа зависимостей
    3. Инициализация аккумулятора
    4. Файлы которые нужно хранить в памяти до окончания сборки
    5. Сохранение манифестов
        5.1 contents.{json,js}
        5.2 module-dependencies.json
        5.3 deanonymizeData.json
        5.4 routes-info.json
        5.5 packwsmod.json
        5.6 packwsmodContents.json
        5.7 packjscss.json
        5.8 custompack.json
*/
const wsPath    = path.join(argv['ws-path']);
const isUnixSep = path.sep === '/';
let since       = 0;
let _acc        = {};
let contents    = { // manifest
   modules: {},
   xmlContents: {},
   htmlNames: {},
   jsModules: {},
   services: {},
   requirejsPaths: {
      WS: removeLeadingSlash(path.join(argv.application, 'ws'))
   }
};

let modulesContents = {
};

function contentsBlank() {
   return {
      modules: {},
      xmlContents: {},
      htmlNames: {},
      jsModules: {},
      services: {},
      requirejsPaths: {
         WS: removeLeadingSlash(path.join(argv.application, 'ws'))
      }
   };
}

let moduleDependencies  = { nodes: {}, links: {} };
let deanonymizeData = {
   anonymous: {},
   badRequireDeps: {}
};
let routesInfo          = {};
let modulesRoutesInfo   = {};
let packwsmod           = {};
let packwsmodContents   = {};
let packjscss           = {};

// let packjscssContents   = {};
let custompack          = {};

try {
   // 1.1 contents.{json,js}
   contents = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'contents.json')));
} catch (err) {
   nlog.warn(err);
}
if (argv.service_mapping) {
   let srv_arr = argv.service_mapping.trim().split(' ');
   if (srv_arr.length % 2 == 0) {
      contents.services = contents.services || {};
      for (let i = 0, l = srv_arr.length; i < l; i += 2) {
         contents.services[srv_arr[i]] = srv_arr[i + 1];
      }
   } else {
      nlog.error('Services list must be even!');
   }
}

try {
   // 1.2 module-dependencies.json
   moduleDependencies = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'module-dependencies.json')));
} catch (err) {
   nlog.warn(err);
}
try {
   // 1.3 deanonymizeData.json
   deanonymizeData = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'deanonymizeData.json')));
} catch (err) {
   nlog.warn(err);
}

try {
   // 1.4 routes-info.json
   routesInfo = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'routes-info.json')));
} catch (err) {
   nlog.warn(err);
}

try {
   // 1.5 packwsmod.json
   packwsmod           = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'packwsmod.json')));

   // 1.6 packwsmodContents.json
   packwsmodContents   = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'packwsmodContents.json')));
} catch (err) {
   nlog.warn(err);
}

try {
   // 1.7 packjscss.json
   packjscss = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'packjscss.json')));
} catch (err) {
   nlog.warn(err);
}

try {
   // 1.8 custompack.json
   custompack = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', 'custompack.json')));
} catch (err) {
   nlog.warn(err);
}

let modulesPaths = JSON.parse(fs.readFileSync(argv.modules));
for (let i = 0, l = modulesPaths.length; i < l; i++) {
   if (argv.application === translit(path.basename(modulesPaths[i]))) {
      throw new Error(
         `Имя сервиса и имя модуля облака не должны совпадать.
            Сервис: ${argv.application.replace('/', '')}'
            Модуль: ${translit(path.basename(modulesPaths[i]))}`
      );
   }

   let moduleNS = translit(path.basename(modulesPaths[i])); // path.basename(modulesPaths[i]);
   if (!contents.modules[moduleNS]) {
      contents.modules[moduleNS] = moduleNS;
   }
   if (!contents.requirejsPaths[moduleNS]) {
      contents.requirejsPaths[moduleNS] = removeLeadingSlash(path.join(argv.application, 'resources', moduleNS)).replace(/\\/g, '/');
   }
}

// 2. Инициализация графа зависимостей
let graph = new DepGraph();
graph.fromJSON(moduleDependencies);


// 3. Инициализация аккумулятора
// Составляем список файлов, которые будут участвовать в сборке
let globPattern = patternFromModulesArr(modulesPaths, []);
let wsPattern   = path.join(argv.root, argv.application, 'ws/**/*.*');
nlog.info('START CREATING ACC');
let filesArr = glob.sync(globPattern);
let wsArr    = glob.sync(wsPattern);
for (let i = 0, l = filesArr.length; i < l; i++) {
   _acc[filesArr[i]]  = null;
}
for (let i = 0, l = wsArr.length; i < l; i++)    {
   if (wsArr[i].endsWith('.gz')) {
      continue;
   }
   _acc[wsArr[i]]     = null;
}
nlog.info('CREATING ACC DONE');

module.exports = opts => {
   opts = assign({}, {

      // 4. Файлы которые нужно хранить в памяти до окончания сборки
      ext: ['.js', '.tmpl', '.html', '.xhtml']
   }, opts);

   if (!Array.isArray(opts.ext)) {
      opts.ext = [opts.ext];
   }

   if (opts.modules/* && !_acc*/) {
      for (let i = 0, l = opts.modules.length; i < l; i++) {
         if (argv.application === translit(path.basename(opts.modules[i]))) {
            throw new Error(
               `Имя сервиса и имя модуля облака не должны совпадать.
                        Сервис: ${argv.application.replace('/', '')}'
                        Модуль: ${translit(path.basename(opts.modules[i]))}`
            );
         }

         let moduleNS = translit(path.basename(modulesPaths[i])); // path.basename(modulesPaths[i]);
         if (!contents.modules[moduleNS]) {
            contents.modules[moduleNS] = moduleNS;
         }
         if (!contents.requirejsPaths[moduleNS]) {
            contents.requirejsPaths[moduleNS] = removeLeadingSlash(path.join(argv.application, 'resources', moduleNS)).replace(/\\/g, '/');
         }
      }
   } else {
      try {
         opts.modules = JSON.parse(fs.readFileSync(argv.modules));

         // globPattern  = patternFromModulesArr(opts.modules, opts.ext);
         for (let i = 0, l = opts.modules.length; i < l; i++) {
            if (argv.application === translit(path.basename(opts.modules[i]))) {
               throw new Error(
                  `Имя сервиса и имя модуля облака не должны совпадать.
                        Сервис: ${argv.application.replace('/', '')}'
                        Модуль: ${translit(path.basename(opts.modules[i]))}`
               );
            }

            let moduleNS = translit(path.basename(modulesPaths[i])); // path.basename(modulesPaths[i]);
            if (!contents.modules[moduleNS]) {
               contents.modules[moduleNS] = moduleNS;
            }
            if (!contents.requirejsPaths[moduleNS]) {
               contents.requirejsPaths[moduleNS] = removeLeadingSlash(path.join(argv.application, 'resources', moduleNS)).replace(/\\/g, '/');
            }
         }
      } catch (err) {
         opts.modules = err;
      }
   }

   return through2.obj(
      function(file, enc, cb) {
         if (file.isNull()) {
            return cb(null, file);
         }
         if (file.isStream()) {
            return cb(new PluginError('gulp-sbis-acc', 'Streaming not supported'));
         }
         if (opts.modules instanceof Error) {
            return cb(new PluginError('gulp-sbis-acc', opts.modules.message));
         }

         if (~file.path.indexOf(wsPath)) {
            file.path = path.join(argv.root, argv.application, 'ws', file.relative);
            file.base = path.join(argv.root, argv.application, 'ws');
            file.__WS = true;
         } else {
            if (path.sep == '/') {
               file.base = path.join(file.base, '../');
            }
         }

         let mtime = new Date(file.stat.mtime).getTime();
         if (mtime > since) {
            since = mtime;
         }


         let filePath = isUnixSep ? file.path : file.path.replace(/\\/g, '/');
         let dest = file.__WS ? path.join(argv.root, argv.application, 'ws', file.relative) : path.join(argv.root, argv.application, 'resources', translit(file.relative));

         if (['.styl', '.less', '.scss', '.sass'].some(ext => path.extname(dest) === ext)) {
            dest = gutil.replaceExtension(dest, '.css');
         }

         if (!file.__WS) {
            // if (!contents.modules[moduleNS]) contents.modules[moduleNS] = moduleNS;
            // if (!contents.requirejsPaths[moduleNS]) contents.requirejsPaths[moduleNS]
            let module = translit(file.relative.split(/[\\/]/)[0]);
            if (!modulesContents[module]) {
               try {
                  modulesContents[module] = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', module, 'contents.json')));
               } catch (err) {
                  modulesContents[module]                 = contentsBlank();
                  modulesContents[module].modules         = contents.modules;
                  modulesContents[module].requirejsPaths  = contents.requirejsPaths;
                  modulesContents[module].services        =  contents.services;
               }
            }
            if (!modulesRoutesInfo[module]) {
               try {
                  modulesRoutesInfo[module] = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'resources', module, 'routes-info.json')));
               } catch (err) {
                  modulesRoutesInfo[module] = {};
               }
            }
         } else {
            try {
               modulesContents.ws = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'ws', 'contents.json')));
            } catch (err) {
               modulesContents.ws                  = contentsBlank();
               modulesContents.ws.modules          = contents.modules;
               modulesContents.ws.requirejsPaths   = contents.requirejsPaths;
               modulesContents.ws.services         =  contents.services;
            }
            if (!modulesRoutesInfo.ws) {
               try {
                  modulesRoutesInfo.ws = JSON.parse(fs.readFileSync(path.join(argv.root, argv.application, 'ws', 'routes-info.json')));
               } catch (err) {
                  modulesRoutesInfo.ws = {};
               }
            }
         }

         if (dest.endsWith('.package.json')) {
            custompack[dest] = file.contents + '';
         }

         // сохраняем ВСЕ файлы в аккумуляторе (контент сохраняется только для файлов, которые перечислены в пункте 4)
         _acc[filePath] = {
            __WS: file.__WS || false,
            cwd: file.cwd + '',
            base: file.base + '',
            path: file.path + '',
            relative: file.relative + '',
            dest: dest,
            contents: opts.ext.some(ext => ext === path.extname(file.relative)) ? file.contents.toString('utf8') : null
         };

         cb(null, file);
      },
      function(cb) {
         if (since) {
            let lastmtimeJSON = new VFile({

               // cwd base path contents
               base: path.join(argv.root, argv.application, 'resources'),
               path: path.join(argv.root, argv.application, 'resources', 'lastmtime.json'),
               contents: new Buffer(JSON.stringify({ lastmtime: since + 100 }))
            });
            lastmtimeJSON.__MANIFEST__ = true;
            this.push(lastmtimeJSON);
         }

         if (_acc) {
            let _contents = {};
            for (let k in _acc) {
               _contents[k] = null;
            }
            let accJSON = new VFile({

               // cwd base path contents
               base: path.join(argv.root, argv.application, 'resources'),
               path: path.join(argv.root, argv.application, 'resources', 'acc.json'),
               contents: new Buffer(JSON.stringify(_contents))
            });
            accJSON.__MANIFEST__ = true;
            this.push(accJSON);
         }

         cb();
      }
   );
};

// даём доступ только на чтение содержимого аккумулятора другим таскам
Object.defineProperty(module.exports, 'acc', {
   enumerable: false,
   configurable: false,
   get: function() {
      return _acc; 
   }
});

Object.defineProperty(module.exports, 'contents', {
   enumerable: false,
   configurable: false,
   get: function() {
      return contents; 
   }
});

module.exports.modulesContents = modulesContents;

Object.defineProperty(module.exports, 'deanonymizeData', {
   enumerable: false,
   configurable: false,
   get: function() {
      return deanonymizeData; 
   }
});

module.exports.modules      = modulesPaths;
module.exports.graph        = graph; // даём к графу зависимостей другим таскам
module.exports.routesInfo   = routesInfo;
module.exports.modulesRoutesInfo = modulesRoutesInfo;

// делает пометку у файла, что он является анонимным т.е. это модуль без имени. define([deps...],function(deps...){})
module.exports.markAsAnonymous = filePath => {
   filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');

   if ((filePath in _acc) && _acc[filePath]) {
      _acc[filePath].__anonymous = true;
   }
};

// убирает пометку у файла, что он является анонимным
// это нужно при сохранении манифеста acc, когда всем анонимным модулям уже проставили имена на основании их пути
module.exports.unMarkAsAnonymous = filePath => {
   filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');

   if ((filePath in _acc) && _acc[filePath]) {
      _acc[filePath].__anonymous = false;
   }
};

// помечает файл в аккумуляторе как файл роутинга
// на основании этой метки запускается суб-таска 06-routes-search, которая генерирует routes-info.json
module.exports.markAsRoute = filePath => {
   filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');

   if ((filePath in _acc) && _acc[filePath]) {
      _acc[filePath].__route = true;
   }
};

// снимает метку с файла в аккумуляторе что он является роутингом
module.exports.unMarkAsRoute = filePath => {
   filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');

   if ((filePath in _acc) && _acc[filePath]) {
      _acc[filePath].__route = false;
   }
};

module.exports.addAst = (filePath, ast) => {
   filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');

   if ((filePath in _acc) && _acc[filePath]) {
      _acc[filePath].__ast = ast;
   }
};


module.exports.fillAnonymous = filePath => {
   deanonymizeData.anonymous[filePath] = 1; 
};

module.exports.fillBadRequireDeps = (deps, filePath) => {
   if (Array.isArray(deps)) {
      for (let i = 0, l = deps.length; i < l; i++) {
         deanonymizeData.badRequireDeps[deps[i]] = (filePath || 1);
      }
   } else {
      deanonymizeData.badRequireDeps[deps] = (filePath || 1);
   }
};

// можем вручную добавить файлу в аккумуляторе контент, например если тип этого файла не был указан в пункте 4
// или если требуется подгрузить файл при инкрементальной сборке или паковке
module.exports.setFileContents = (filePath, text) => {
   let _filePath = filePath.substring();
   let _filePathAcc = isUnixSep ? _filePath : _filePath.replace(/\\/g, '/');
   if (_acc[_filePathAcc]) {
      _acc[_filePathAcc].contents = text;
   }
};

// удаляет файл из манифестов, требуется при инкрементальной сборке, точнее инкрементальном удалении файлов
module.exports.remove = filePath => {
   let _filePath = filePath.substring();

   // DELETE FROM ACC
   let _filePathAcc = isUnixSep ? _filePath : _filePath.replace(/\\/g, '/');
   delete _acc[_filePathAcc];

   // DELETE FROM CONTENTS.jsModules
   // FIXME: в исходниках нет Модули интерфейса
   let _filePathContents = /.+Модули\sинтерфейса[\/\\](.+)/i.exec(_filePath)[1];
   _filePathContents = translit(_filePathContents).replace(/\\/g, '/');
   for (let jsModule in contents.jsModules) {
      if (contents.jsModules[jsModule] === _filePathContents) {
         delete contents.jsModules[jsModule];
         break;
      }
   }

   // TODO: удалять из графа и всех зависимостей contents (возможно и физически из public)
};

// добавляет файл в аккумулятор по исходному пути до файла
module.exports.add = newPath => {
   let filePath = newPath.substring();

   if ('string' === typeof filePath) {
      filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');
      if (!(filePath in _acc)) {
         _acc[filePath] = null;
      }
   } else if (filePath.contents && filePath.cwd && filePath.base && filePath.path && filePath.relative) {
      let _filePath = isUnixSep ? filePath.path : filePath.path.replace(/\\/g, '/');
      if (_filePath in _acc) {
         _acc[_filePath] = {
            cwd: filePath.cwd + '',
            base: filePath.base + '',
            path: filePath.path + '',
            relative: filePath.relative + '',
            contents: filePath.contents.toString('utf8')

            // isNew: true,
         };
      }
   }
};

module.exports.loadFile = filePath => {
   filePath = isUnixSep ? filePath : filePath.replace(/\\/g, '/');
   let base, relative;
   modulesPaths.forEach(m => {
      if (filePath.startsWith(m)) {
         base = path.join(m, '../');
         let re = new RegExp(m.replace(/\//g, '[\\/\\\\]').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + '[\\/\\\\]?(.+)');
         relative = (re.exec(filePath))[1];
      }
   });

   if (!base) {
      if (/[\/\\]ws[\/\\]/i.test(filePath)) {
         base = argv['ws-path'];
         let re = new RegExp(argv['ws-path'] + '[\\/\\\\]?(.+)');
         relative = (re.exec(filePath))[1];
      }
   }

   // let base        = /.+Модули\sинтерфейса|.+sbis3-builder/i.exec(filePath);
   // let relative    = /.+Модули\sинтерфейса[\/\\](.+)[\/\\]?|.+sbis3-builder[\/\\](.+)[\/\\]?/i.exec(filePath);
   _acc[filePath] = {
      cwd: process.cwd(),

      // base: base[0],
      base: base,
      path: filePath,

      // relative: relative[1],
      relative: relative,
      contents: fs.readFileSync(filePath) + ''
   };
};

// добавляет файл в аккумулятор по realtive пути до файла (используется только при построении html-файлов в таске 02-static)
module.exports.loadFileByRelative = relativePath => {
   // relativePath = isUnixSep ? relativePath : relativePath.replace(/\\/g, '/');
   relativePath = relativePath.replace(/[\/\\]/g, '.');
   relativePath = relativePath.replace(/\s/g, '\\s');
   let fullPath, base, relative;
   let re = new RegExp(relativePath + '$', 'i');

   for (let p in _acc) {
      // if (p.endsWith('grayTheme_newAccrodion.html')) {
      //     console.log('\np=', p);
      //     process.exit(0)
      //
      // }
      if (re.test(p)) {
         fullPath = p;
         break;
      }
   }
   if (fullPath) {
      modulesPaths.forEach(m => {
         if (fullPath.startsWith(m)) {
            base = path.join(m, '../');
            let re = new RegExp(m.replace(/\//g, '[\\/\\\\]').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + '[\\/\\\\]?(.+)');
            relative = (re.exec(fullPath))[1];
         }
      });
   }

   if (!base) {
      if (fullPath && /[\/\\]ws[\/\\]/i.test(fullPath)) {
         base = argv['ws-path'];
         let re = new RegExp(argv['ws-path'] + '[/\]?(.+)');
         relative = (re.exec(fullPath))[1];
      }
   }

   // let base        = /.+Модули\sинтерфейса|.+sbis3-builder/i.exec(filePath);
   // let relative    = /.+Модули\sинтерфейса[\/\\](.+)[\/\\]?|.+sbis3-builder[\/\\](.+)[\/\\]?/i.exec(filePath);
   _acc[fullPath] = {
      cwd: process.cwd(),

      // base: base[0],
      base: base,
      path: fullPath,

      // relative: relative[1],
      relative: relative,
      contents: fs.readFileSync(fullPath) + ''
   };

   return fullPath;
};

// достает файл из аккумулятора по исходному пути до файла (не важно unix-путь или win-путь)
module.exports.getFile = filePath => {
   if ('string' === typeof filePath) {
      let _filePath = filePath.substring();
      _filePath = isUnixSep ? _filePath : _filePath.replace(/\\/g, '/');
      return (_acc[_filePath]);
   }
};

// достает файл из аккумулятора по конечному пути до файла (имеется ввиду путь, который resources/...)
module.exports.getFileByDest = destPath => {
   let file;
   if ('string' === typeof destPath) {
      destPath = destPath.replace(/[\/\\]/g, path.sep);
      for (let fp in _acc) {
         if (_acc[fp] && _acc[fp].dest && _acc[fp].dest == destPath) {
            file = _acc[fp];
            break;
         }
      }
   }

   return file;
};

// достает файл из аккумулятора по конечному пути до файла (имеется ввиду путь, который resources/... но может быть без префикса resources)
// это нигде не используется, но возможно пригодится
module.exports.getFileByRelativeDest = destPath => {
   let file;
   if ('string' === typeof destPath) {
      destPath = destPath.replace(/[\/\\]/g, path.sep);
      for (let fp in _acc) {
         if (_acc[fp] && _acc[fp].dest && _acc[fp].dest.endsWith(destPath)) {
            file = _acc[fp];
            break;
         }
      }
   }

   return file;
};

// если мы хотим узнать путь до исходника, зная путь до сконвертированного файла
module.exports.getFilePathByRelativeDest = destPath => {
   let file;
   if ('string' === typeof destPath) {
      destPath = destPath.replace(/[\/\\]/g, path.sep);
      for (let fp in _acc) {
         if (_acc[fp] && _acc[fp].dest && _acc[fp].dest.endsWith(destPath)) {
            file = _acc[fp].path;
            break;
         }
      }
   }

   return file;
};

module.exports.addContentsJsModule = (moduleName, fileRelative) => {
   contents.jsModules[moduleName] = translit(fileRelative).replace(/\\/g, '/');
};

module.exports.addContentsHtmlNames = (k, v) => {
   contents.htmlNames[k] = v; 
};


module.exports.packwsmod            = packwsmod;
module.exports.packwsmodContents    = packwsmodContents;
module.exports.packwsmodXML         = null;

module.exports.packjscss            = packjscss;
module.exports.custompack           = custompack;


module.exports.addContentsXmlDeprecated = (k, v) => {
   v = v.replace(/^[\/\\]{0,1}resources[\/\\]{0,1}/i, '');
   contents.xmlContents[k] = v;
};

module.exports.addContentsHtmlDeprecated = (k, v) => {
   contents.htmlNames[k] = v; 
};

module.exports.containsPath = filePath => {
   if ('string' === typeof filePath) {
      let _filePath = filePath.substring();
      _filePath = isUnixSep ? _filePath : _filePath.replace(/\\/g, '/');
      if (_acc[_filePath]) {
         return true;
      }
      return false;
   }
};

module.exports.hasPath = filePath => {
   if ('string' === typeof filePath) {
      let _filePath = filePath.substring();
      _filePath = isUnixSep ? _filePath : _filePath.replace(/\\/g, '/');
      return _filePath in _acc;
   }
};

module.exports.clear = () => {
   for (let key in _acc) {
      _acc[key] = null;
   } 
};

function patternFromModulesArr(modules) {
   let res = '{';
   let l = modules.length;
   modules.forEach((m, i) => {
      res += m;
      if ((l - 1) == i) {
         res += '}/**/*.*';
      } else {
         res += ',';
      }
   });
   return res;
}

/*
function patternFromModulesArr (modules, ext) {
    let _base     = {};
    let _relative = {};
    let _result   = '';

    modules.forEach(m => {
        // let baseKey = /.+Модули\sинтерфейса/i.exec(m);
        let baseKey = /(.+[\/\\])([A-Za-zА-Яа-я_0-9\s\-\.]{1,100})$/i.exec(m);
        if (Array.isArray(baseKey)) _base[path.normalize(baseKey[1])] = true;

        // let relativeKey = /.+Модули\sинтерфейса[\/\\](.+)[\/\\]?/i.exec(m);
        let relativeKey = baseKey;
        if (Array.isArray(relativeKey) && relativeKey.length >= 3) _relative[path.normalize(baseKey[2])] = true;
    });

    if (Object.keys(_base).length > 1) {
        _result += '{';
        for (let k in _base) {
            if (_result = '{') {
                _result += k;
            } else {
                _result += (',' + k);
            }
        }
        _result += '}';
    } else if (Object.keys(_base).length === 1) {
        _result = Object.keys(_base)[0];
    }
    if (Object.keys(_relative).length > 1) {
        _result += path.sep + '{';
        for (let k in _relative) {
            if (_result.endsWith('{')) {
                _result += k;
            } else {
                _result += (',' + k);
            }
        }
        _result += '}' + path.sep + '**' + path.sep + '*.*';
        /!*_result += '}' + path.sep + '**' + path.sep + '*{';

        for (let i = 0, l = ext.length; i < l; i++) {
            if (_result.endsWith('{')) {
                _result += ext[i];
            } else {
                _result += (',' + ext[i]);
            }
        }
        _result += '}';*!/
    } else if (Object.keys(_relative).length === 1) {
        _result += path.sep + Object.keys(_relative)[0] + path.sep + '**' + path.sep + '*.*';
        /!*_result += path.sep + Object.keys(_relative)[0] + path.sep + '**' + path.sep + '*{';
        for (let i = 0, l = ext.length; i < l; i++) {
            if (_result.endsWith('{')) {
                _result += ext[i];
            } else {
                _result += (',' + ext[i]);
            }
        }
        _result += '}';*!/
    }

    return _result;
}*/
