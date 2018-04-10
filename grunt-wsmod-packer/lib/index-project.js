'use strict';

const fs = require('fs');
const dom = require('tensor-xmldom');
const domParser = new dom.DOMParser();

const cache = {};

const grabFailedModule = /Original\smessage:\sModule\s([\w\.]+)\sis\snot\sdefined/;
const jsFilter = /^js!|^js$/;

// Сделаем стэк жирнее, но так будет чуть проще искать ошибки
Error.stackTraceLimit = 100;

//Тут описываем контролы, которые могут содержать вложенные шаблоны
const complexControls = {
   TemplatedArea: {

      //наймспейс, в котором располагается класс
      'namespace': '$ws.proto.TemplatedAreaAbstract',

      //функция получения списка возможных шаблонов из опций комопнента
      'getTemplates': function(cfg) {
         let templates = [];
         if (cfg.template) {
            templates.push(cfg.template);
         }

         if (cfg.expectedTemplates && cfg.expectedTemplates.length) {
            templates = templates.concat(cfg.expectedTemplates);
         }
         return templates;
      }
   },
   Tabs: {
      'namespace': '$ws.proto.Tabs',
      'getTemplates': function(cfg) {
         const templates = [];
         if (cfg.tabs) {
            cfg.tabs.forEach(function(t) {
               if (t && t.template) {
                  templates.push(t.template);
               }
            });
         }
         return templates;
      }
   }
};

function _isSubclass(cls, sup) {
   if (sup) {
      return (function(c) {
         if (c == sup) {
            return true;
         } else {
            if (c && c.superclass && c.superclass.$constructor) {
               return arguments.callee(c.superclass.$constructor);
            } else {
               return false;
            }
         }
      })(cls);
   } else {
      return false;
   }
}

/**
 * Получение конструктора по нэймспейсу
 * @param namespace
 * @private
 */
function _getConstructor(namespace) {
   let path,
      paths = namespace.split('.'),
      result = (function() {
         return this || (0, eval)('this');
      }());

   while (path = paths.shift()) {
      result = result[path];
      if (!result) {
         break;
      }
   }
   return result;
}

/**
 * Возвращает true если проверяемый класс подразумевает наличие встроенных шаблонов
 * @param classCtor
 * @returns {boolean}
 */
function isComplexControl(classCtor) {
   let res = false;
   for (const i in complexControls) {
      if (complexControls.hasOwnProperty(i)) {
         complexControls[i].class = complexControls[i].class || _getConstructor(complexControls[i].namespace);
         if (_isSubclass(classCtor, complexControls[i].class)) {
            res = true;
            break;
         }
      }
   }
   return res;
}

/**
 * Получение массива возможных шаблонов из опций
 * @param obj
 * @returns {*}
 */
function getExpectedTemplates(obj) {
   for (const i in complexControls) {
      if (complexControls.hasOwnProperty(i) && _isSubclass(obj.ctor, complexControls[i].class)) {
         return complexControls[i].getTemplates(obj.cfg);
      }
   }
   return [];
}

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

function _addTemplateDependencies(service, template, knownContainers) {

   function _processTemplate(t) {
      _addTemplateDependencies(service, t, knownContainers);
      (cache[service][t] || []).forEach(function(d) {
         _addDependency(cache[service][template], d);
      });
      if (cache[service][t] === undefined && t.indexOf('js!') === 0) {
         // Все равно добавим, считаем что у нас это компонент
         _addDependency(cache[service][template], t.substr(3));
      }
   }

   const containers = knownContainers[template];
   if (containers) {
      containers.forEach(function(ctr) {
         getExpectedTemplates(ctr).forEach(function(t) {
            _processTemplate(t);
         });
      });
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
   let name, value, type, hasValue,
      functionsPaths = [],

      // Это место переписано так не случайно. От старого вариант почему-то ВНЕЗАПНО ломался каверидж
      retvalFnc = function() {
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
      retval = new retvalFnc();

   parseStack = parseStack || [];

   if (configRoot && configRoot.childNodes) {
      const children = configRoot.childNodes;
      let pos = -1;
      for (let i = 0, l = children.length; i < l; i++) {
         const child = children[i];
         if (child.nodeName && child.nodeName == 'option') {
            pos++;
            name = child.getAttribute('name');
            type = child.getAttribute('type');
            value = child.getAttribute('value');
            hasValue = child.hasAttribute('value');

            parseStack.push(name || pos);

            //if (type === 'array' || name === null || value === null){
            if (type === 'array' || !hasValue && type != 'cdata') {
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
   let cP = type.indexOf(':'),
      moduleStubs = global.requirejs('Core/moduleStubs'),
      _const = global.requirejs('Core/constants'),
      className, moduleName;

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
      e.message = "Don't know how to load " + type + '. Resolved class is ' + className + '. Resolved module is ' + moduleName + '. Original message: ' + e.message +
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
      let configTemp = {},
         _const = global.requirejs('Core/constants'),
         xmlContents = _const.xmlContents,
         contentsKeys = Object.keys(xmlContents),
         Deferred = global.requirejs('Core/Deferred'),
         dRes = new Deferred();

      cache[application] = {};
      configTemp[application] = {};

      // Первый проход. Собираем первый уровень зависимостей для всех шаблонов
      (function stepper(res) {
         let fileContent = null,
            ParallelDeferred = global.requirejs('Core/ParallelDeferred'),
            pdStep = new ParallelDeferred(),
            resDom, divs, div, configAttr;

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
                  if (div.getAttribute('wsControl') == 'true') {
                     configAttr = div.getElementsByTagName('configuration')[0];
                     if (configAttr) {
                        (function(div, configAttr) {
                           let
                              ClassMapper = global.requirejs('Deprecated/ClassMapper'),
                              typename = ClassMapper.getClassMapping(div.getAttribute('type'));
                           pdStep.push(resolveType(typename).addCallback(function(classCtor) {
                              const config = parseConfiguration(configAttr, false);
                              const baseConfig = resolveOptions(classCtor);
                              const cMerge = global.requirejs('Core/core-merge');
                              const finalConfig = cMerge(baseConfig, config[0]);

                              if (isComplexControl(classCtor)) {
                                 configTemp[application][res].push({
                                    'ctor': classCtor,
                                    'cfg': finalConfig
                                 });
                              }
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
      })(contentsKeys.shift());

      return dRes.addCallback(function() {
         /**
             * Второй проход.
             * - Пробегаемся по шаблонным областям
             * - Cмотрим их возможные/текущие шаблоны
             * - Добавляем их зависимости в зависимости к текущему шаблону
             */
         const temp = Object.keys(configTemp);
         prog = 0;
         temp.forEach(function(service) {
            const svcContainers = configTemp[service];
            Object.keys(configTemp[service]).forEach(function(resource) {
               _addTemplateDependencies(service, resource, svcContainers);
            });

         });
      });

   },
   getDeps: function(application, template) {
      return cache[application] && cache[application][template] || [];
   },
   toJSON: function() {
      return JSON.stringify(cache, null, 2);
   }
};
