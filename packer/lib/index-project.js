'use strict';

const fs = require('fs-extra');
const dom = require('tensor-xmldom');
const domParser = new dom.DOMParser();

const cache = {};

const grabFailedModule = /Original\smessage:\sModule\s([\w\.]+)\sis\snot\sdefined/;
const jsFilter = /^js!|^js$/;

// Сделаем стэк жирнее, но так будет чуть проще искать ошибки
Error.stackTraceLimit = 100;

function findPath(from, to, graph) {
   const storage = [];
   const path = [];

   from = 'js!' + from;

   _findPath(from, to, path, storage, graph);
   return storage;
}

function _findPath(from, to, path, storage, graph) {
   path.push(from);
   const deps = graph.getDependenciesFor(from);
   if (!deps.length) {
      path.pop();
   } else {
      deps.forEach(function(mod) {
         const _mod = mod.split('!');
         if (_mod[0] == to || _mod[1] == to) {
            storage.push(path.join(' -> ') + ' -> ' + _mod.join('!'));
         } else {
            if (jsFilter.test(mod)) {
               _findPath(mod, to, path, storage, graph);
            }
         }
      });
      path.pop();
   }
}

function _addDependency(store, dependency) {
   const ClassMapper = global.requirejs('Deprecated/ClassMapper');
   dependency = ClassMapper.getClassMapping(dependency);
   if (store.indexOf(dependency) == -1) {
      store.push(dependency);
   }
}

function findCDATA(node, needValue) {
   let childNode, styleData;
   for (let i = 0, l = node.childNodes.length; i < l; i++) {
      childNode = node.childNodes[i];
      if (childNode.nodeType === 4) {
         styleData = needValue ? childNode.nodeValue : childNode;
         break;
      }
   }
   return styleData;
}

function parseConfiguration(configRoot, makeArray, parseStack) {
   let name, value, type, hasValue;
   const
      functionsPaths = [],

      // Это место переписано так не случайно. От старого вариант почему-то ВНЕЗАПНО ломался каверидж
      RetvalFnc = function() {
         const self = this;
         self.mass = makeArray ? [] : {};
         self.push = function(name, value) {
            if (makeArray) {
               self.mass.push(value);
            } else if (name !== null) {
               self.mass[name] = value;
            }
         };
      },
      retval = new RetvalFnc();

   parseStack = parseStack || [];

   if (configRoot && configRoot.childNodes) {
      const children = configRoot.childNodes;
      let pos = -1;
      for (let i = 0, l = children.length; i < l; i++) {
         const child = children[i];
         if (child.nodeName && child.nodeName === 'option') {
            pos++;
            name = child.getAttribute('name');
            type = child.getAttribute('type');
            value = child.getAttribute('value');
            hasValue = child.hasAttribute('value');

            parseStack.push(name || pos);

            if (type === 'array' || !hasValue && type !== 'cdata') {
               //Если не в листе дерева, то разбираем дальше рекурсивно
               if (!hasValue) {
                  const r = parseConfiguration(child, type === 'array', parseStack);
                  value = r[0];
                  functionsPaths.push.apply(functionsPaths, r[1]);
               }

               retval.push(name, value);
            }

            //добрались до листа дерева
            else {
               switch (type) {
                  case 'cdata':
                     retval.push(name, findCDATA(child, true));
                     break;
                  case 'boolean':
                     retval.push(name, value === 'true');
                     break;
                  case 'function':
                  case 'moduleFunc':
                  case 'dialog':
                  case 'command':
                  case 'newpage':
                  case 'page':
                  case 'menu':
                     if (typeof value === 'string' && value.length > 0) {
                        functionsPaths.push(parseStack.join('/'));
                        retval.push(name, type + '#' + value);
                     }
                     break;
                  case null:
                  default :
                     if (value === 'null') {
                        value = null;
                     }
                     retval.push(name, value);
                     break;
               }
            }
            parseStack.pop();
         }
      }
   }
   return [retval.mass, functionsPaths];
}

function resolveType(type) {
   const cP = type.indexOf(':'),
      moduleStubs = global.requirejs('Core/moduleStubs'),
      _const = global.requirejs('Core/constants');
   let className,
      moduleName;

   if (cP !== -1) {
      className = type.substring(cP + 1);
      type = type.substring(0, cP);
   }

   const p = type.split('/');
   if (cP === -1) {
      className = p[p.length - 1];
   }

   if (className in _const.jsCoreModules || className in _const.jsModules) {
      moduleName = className;
   } else {
      moduleName = 'SBIS3.CORE.' + className;
   }

   return moduleStubs.requireModule(moduleName).addCallbacks(function(modArray) {
      return modArray[0];
   }, function(e) {
      e.message = 'Don\'t know how to load ' + type + '. Resolved class is ' + className + '. Resolved module is ' + moduleName + '. Original message: ' + e.message +
         (e.requireType ? '. RequireType: ' + e.requireType : '') + (e.requireMap ? '. RequireMap: ' + JSON.stringify(e.requireMap, null, 2) : '') +
         (e.requireModules && e.requireModules.length ? '. RequireModules: ' + JSON.stringify(e.requireModules) : '') + '.\nError stack: ' + e.stack;
      return e;
   });
}

function resolveOptions(ctor) {
   if (ctor) {
      const cMerge = global.requirejs('Core/core-merge');
      return cMerge(
         resolveOptions(ctor.superclass && ctor.superclass.$constructor),
         ctor.prototype.$protected && ctor.prototype.$protected._options || {},
         {clone: true});
   } else {
      return {};
   }
}

module.exports = {
   index: function(root, application, grunt, graph) {
      const configTemp = {},
         _const = global.requirejs('Core/constants'),
         xmlContents = _const.xmlContents,
         contentsKeys = Object.keys(xmlContents),
         Deferred = global.requirejs('Core/Deferred'),
         dRes = new Deferred();

      cache[application] = {};
      configTemp[application] = {};

      //Собираем первый уровень зависимостей для всех шаблонов
      const stepper = function(res) {
         const
            ParallelDeferred = global.requirejs('Core/ParallelDeferred'),
            pdStep = new ParallelDeferred();

         let fileContent = null,
            resDom,
            divs,
            div,
            configAttr;

         if (res) {
            cache[application][res] = [];
            configTemp[application][res] = [];

            try {
               fileContent = fs.readFileSync(root + xmlContents[res] + '.xml');
            } catch (e) {
               grunt.fail.fatal(e);
            }

            if (fileContent) {
               resDom = domParser.parseFromString(fileContent.toString(), 'text/html');
               divs = resDom.getElementsByTagName('div');
               for (let i = 0, l = divs.length; i < l; i++) {
                  div = divs[i];
                  if (div.getAttribute('wsControl') === 'true') {
                     configAttr = div.getElementsByTagName('configuration')[0];
                     if (configAttr) {
                        (function(div, configAttr) {
                           const
                              ClassMapper = global.requirejs('Deprecated/ClassMapper'),
                              typename = ClassMapper.getClassMapping(div.getAttribute('type'));
                           pdStep.push(resolveType(typename).addCallback(function(classCtor) {
                              const config = parseConfiguration(configAttr, false);
                              const baseConfig = resolveOptions(classCtor);
                              const cMerge = global.requirejs('Core/core-merge');
                              const finalConfig = cMerge(baseConfig, config[0]);
                              _addDependency(cache[application][res], typename, finalConfig);
                           }).addErrback(function(e) {
                              const failedModule = e.message && e.message.match(grabFailedModule);
                              if (failedModule && failedModule[1]) {
                                 const failedPaths = findPath(typename, failedModule[1], graph);
                                 e.message += '\nFailed chains:\n' + JSON.stringify(failedPaths, null, 3);
                              }
                              console.error('Error while resolving type "' + typename + '"', e.message, e.stack);
                              return e;
                           }));
                        })(div, configAttr);
                     }
                  }
               }
            }
         }

         pdStep.done().getResult().addCallback(function() {
            if (contentsKeys.length) {
               setTimeout(function() {
                  stepper(contentsKeys.shift());
               }, 1);
            } else {
               dRes.callback();
            }
         }).addErrback(function(e) {
            dRes.errback(e);
         });
      };
      stepper(contentsKeys.shift());
      return dRes;
   },
   getDeps: function(application, template) {
      return cache[application] && cache[application][template] || [];
   }
};
