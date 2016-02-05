/**
 * Created by ShilovDA on 11.10.13.
 */

var path = require('path'),
    xmlDom = require('tensor-xmldom'),
    DOMParser = xmlDom.DOMParser,
    parser = new DOMParser(),
    uuid = require('node-uuid'),
    genJsDoc = require('./../jsDoc/generateJsDoc');

var wsExpertComments = /<!--WS-EXPERT([\s\S]+?)WS-EXPERT-->/g,
    translate = /\{\[([\s\S]+?)\]\}/g;

(function () {

   "use strict";

   var optTags = ['option', 'opt', 'options', 'opts'],
       components = {},
       componentsProperties = {},
       words = [],
       jsonOutput,
       ws,
       grunt,
       cwd;

   /**
    * Вычитывает файл со свойствами контрола
    * @param {String} modPath - путь до файла
    * @param {String} modName - название контрола
    */
   function readPropertiesJSON(modPath, modName) {
      var properties = {};

      modPath = path.join(jsonOutput, modName + '.json');
      if (grunt.file.exists(modPath)) {
         try {
            properties = grunt.file.readJSON(modPath);
         } catch(e) {
            grunt.log.error('Can\'t read ' + modPath);
         }
      }
      componentsProperties[modName] = properties;
   }

   /**
    *
    * @param pathToSource
    * @param text
    */
   function readWordsInModule(pathToSource, text) {
      var r = new RegExp('rk *\\( *(["\'][\\S\\s]*?["\']) *\\)', 'g'),
          rW = new RegExp('["\']([\\S\\s]*?)[\'"](?:,[ ]*["\']([\\S\\s]*?)[\'"])?'),
          matches, matchesWords;

      // Поищем за одно и слова для перевода
      while (matches = r.exec(text)) {
         if (matches[1]) {
            matchesWords = rW.exec(matches[1]);
            if (matchesWords) {
               pushKey(matchesWords[1], matchesWords[2] ? matchesWords[2] : '', pathToSource);
            }
         }
      }
   }

   /**
    *
    * @param key
    * @param ctx
    * @param module
    */
   function pushKey(key, ctx, module) {
      var temp = key.trim(),
          tempCtx = ctx.trim(),
          matches;

      if (!temp || /^{{[\S\s]*}}$/.test(temp)) {
         return;
      }

      if (/^{\[[\S\s]*\]}$/.test(temp)) {
         // Надо удалить {[ ]} или {{}}
         temp = (matches = temp.match(/^{\[([\S\s]*)\]}$/)) ? matches[1] : temp;
      }

      if (temp.indexOf('@@') > -1) {
         // Значит в ключе содержится контекст
         tempCtx = temp.substring(0, temp.indexOf('@@'));
         temp = temp.substr(temp.indexOf('@@') + 2);
      }

      words.push({
         key: temp,
         context: tempCtx,
         module: path.dirname(module),
         ui: cwd
      });
   }

   /**
    * Ищет все компоненты и их свойства в папке --root + --application
    * @param cwd
    */
   function findComponentsAndProperties(cwd) {
      var sourceFiles = grunt.file.expand({cwd:cwd}, ['**/*.module.js']),
          text, modName;

      sourceFiles.forEach(function(pathToSource) {
         // Вычитаем файл с модулем, и найдем в нем название модуля
         pathToSource = path.join(cwd, pathToSource);
         text = grunt.file.read(pathToSource);
         if (text) {
            modName = (modName = text.match(/define[\S\s]*?\([\S\s]*?["']js!([A-Za-z0-9\.]+)["']/)) ? modName[1] : false;
            if (modName && !components[modName]) {
               components[modName] = pathToSource;
               // Здесь же получим свойства компонента
               readPropertiesJSON(pathToSource.replace('.module.js', '.json'), modName);
               readWordsInModule(pathToSource, text);
            }
         }
      });
   }

   /**
    * 
    * @param cwd
    */
   function findWordsInXHTML(cwd) {
      var sourceFiles = grunt.file.expand({cwd:cwd}, ['**/*.xhtml']),
          absPath, text;

      sourceFiles.forEach(function(pathToSource) {
         absPath = path.join(cwd, pathToSource);
         // Игнорируем файлы xhtml в ws
         if (!(/^ws\\/.test(absPath) || /\\ws\\/.test(absPath))) {
            text = grunt.file.read(absPath);
            if (text) {
               findWordsInWsExpert(text, absPath);
               findWordsInDOM(text, absPath);
            }
         }
      });
   }

   function findWordsInWsExpert(text, absPath) {
      var posCtx = -1;
      text.replace(wsExpertComments, function(str, commentContent) {
         commentContent.replace(translate, function(str, key) {
            posCtx = key.indexOf('@@');
            if (posCtx > -1) {
               pushKey(key.substr(0, posCtx), key.substr(posCtx + 2), absPath);
            } else {
               pushKey(key, '', absPath);
            }
            return str;
         });
         return str;
      });
   }

   /**
    * Проходит по DOM дереву и набирает простые текстовые ноды и компоненты
    * @param {String} text - текст из xhtml файла
    * @param absPath
    */
   function findWordsInDOM(text, absPath) {
      var dom;
      try {
         dom = parser.parseFromString(text, 'text/html');
         enumChildNodes(dom, absPath);
      } catch(e) {
         grunt.log.error('Can\'t parse DOM' + e);
      }
   }

   /**
    * Перебрать все дочерние узлы
    * @param node
    * @param absPath
    * @param considerTheCurrentNode
    */
   function enumChildNodes(node, absPath, considerTheCurrentNode) {
      function currentNode(node, absPath) {
         if(node.nodeType == 1) {
            if (node.hasAttribute('title')) {
               pushKey(node.getAttribute('title'), '', absPath);
            }

            if (node.localName !== 'component') {
               enumChildNodes(node, absPath);
            } else {
               findWordsInComponent(node, absPath);
            }
         } else if (node.nodeType == 3) {
            if (node.nodeValue && /\S/.test(node.nodeValue) && optTags.indexOf(node.parentNode.localName) === -1) {
               pushKey(node.nodeValue, '', absPath);
            }
         }
      }

      if (considerTheCurrentNode) {
         currentNode(node, absPath);
      }

      if (node.nodeType == 1 || node.nodeType == 9) {
         var child = node.firstChild;
         while (child) {
            currentNode(child, absPath);
            child = child.nextSibling;
         }
      }
   }

   /**
    * Перебирает компонент, ищет переводные свойства в аттрибуте config и набирает теги
    * @param node - элемент компонента
    * @param absPath
    */
   function findWordsInComponent(node, absPath) {
      // Для компонента надо вытащить его имя, и найти файл со свойствами
      var moduleName = node.getAttribute('data-component'),
          cfg = node.getAttribute('config') || '{}',
          properties = componentsProperties[moduleName],
          transProp = [];

      if (properties && Object.keys(properties).length && properties.properties && properties.properties["ws-config"]) {
         propertiesParser(transProp, properties.properties["ws-config"].options, "", moduleName);
      }

      if (transProp.length) {
         // Надо собрать конфиг из аттрибута config, и разобрать его
         try {
            cfg = JSON.parse(cfg);
            if (Object.keys(cfg).length) {
               for (var i = 0, len = transProp.length; i < len; ++i) {
                  findWordsInCfg(cfg, transProp[i].split('/').slice(1), absPath);
               }
            }
         } catch(e) {
            grunt.log.error('Error parsing component configuration: ' + e);
         }
      }

      // Нужно пройтись по детям компонента
      try {
         // Сначала пройдем в глубь и найдем только компоненты
         var child = node.firstChild;
         while (child) {
            if (child.nodeType === 1 && child.localName == 'component') {
               findWordsInComponent(child, absPath);
            }
            child = child.nextSibling;
         }

         // Теперь займемся опциями
         enumComponentChildNodes(transProp, node, '/', absPath);
      } catch(e) {
         grunt.log.error(e);
      }
   }

   /**
    * Рекурсивно проходит по свойствам компонента и находит все перводные свойства
    * Записывает их в массив transPropXPath
    * @param transPropXPath - массив с путями до переводных свойств
    * @param object - входящий объект
    * @param propPath - текущий путь до объекта
    * @param moduleName
    */
   function propertiesParser(transPropXPath, object, propPath, moduleName) {
      if (!object) {
         return;
      }

      Object.keys(object).forEach(function(key) {
         var elem = object[key],
            isCompType = /Array|array/.test(elem.type) ? '@' : /Content|content/.test(elem.type) ? '$' : '';

         if (elem.options) {
            propertiesParser(transPropXPath, elem.options, propPath + '/' + isCompType + key, moduleName);
         } else if (elem.itemType || components[elem.type]) {
            var properties = componentsProperties[elem.itemType || elem.type];
            if (!properties && elem.itemType) {
               var modName = elem.itemType,
                   parentModName = modName.substr(0, modName.indexOf('/'));

               readPropertiesJSON(components[parentModName] ? (path.join(path.dirname(components[parentModName]), modName) +  '.json') : '', modName);
               properties = componentsProperties[modName] || {};
            }

            if (properties && Object.keys(properties).length && properties.properties && properties.properties["ws-config"]) {
               propertiesParser(transPropXPath, properties.properties["ws-config"].options, propPath + '/' + isCompType + key, moduleName);
            }
         } else if (elem.translatable) {
            transPropXPath.push(propPath + '/' + isCompType + key);
         }
      });
   }

   /**
    * Перебирает все теги option и options
    * @param transProp
    * @param node
    * @param xPath
    * @param absPath
    */
   function enumComponentChildNodes(transProp, node, xPath, absPath) {
      var child = node.firstChild,
          i, len;

      while (child) {
         // Только теги опций
         if (child.nodeType != 1 || optTags.indexOf(child.localName) == -1) {
            // Делаем допущение для обычных html тегов, их тоже подготавливаем
            enumChildNodes(child, absPath, true);
            child = child.nextSibling;
            continue;
         }

         var localName = child.localName,
             name = child.hasAttribute('name') ? child.getAttribute('name') : '',
             value = child.hasAttribute('value') ? child.getAttribute('value') : '',
             type = child.hasAttribute('type') ? child.getAttribute('type') : '';

         // Здесь либо option, либо options, либо components, остальное игнорим
         if (localName == 'option' || localName == 'opt') {
            // Переберем массив transProp и поищем эту опцию
            for (i = 0, len = transProp.length; i < len; ++i) {
               if (transProp[i] === xPath + name) {
                  if (value) {
                     pushKey(value, '', absPath);
                  } else {
                     pushKey(child.innerHTML, '', absPath);
                  }
                  break;
               } else if (transProp[i] === xPath + '$' + name) {
                  // Если опция контент и переводится
                  if (value) {
                     findWordsInDOM(value, absPath);
                  } else {
                     enumChildNodes(child, absPath);
                  }
                  break;
               }
            }
         } else if (localName == 'options' || localName == 'opts') {
            if (/Array|array/.test(type)) {
               var pp = xPath + '@' + name,
                   isSimple;

               // Надо понять, массив может хранить сложные типы или нет
               for (i = 0, len = transProp.length; i < len; ++i) {
                  if (transProp[i] === pp) {
                     isSimple = true; break;
                  } else if (transProp[i].indexOf(pp) != -1) {
                     isSimple = false; break;
                  }
               }

               if (isSimple !== undefined) {
                  var childNodes = child.childNodes;
                  for (i = 0, len = childNodes.length; i < len; i++) {
                     var childNode = childNodes[i],
                         childLocalName = childNode.localName;
                     if (childNode.nodeType == 1) {
                        if (isSimple === true && (childLocalName == 'option' || childLocalName == 'opt')) {
                           if (childNode.hasAttribute('value')) {
                              pushKey(childNode.getAttribute('value'), '', absPath);
                           } else {
                              pushKey(childNode.innerHTML, '', absPath);
                           }
                        } else if (isSimple === false && (childLocalName == 'options' || childLocalName == 'opts')) {
                           enumComponentChildNodes(transProp, childNode, pp + '/', absPath);
                        }
                     }
                  }
               }
            } else {
               enumComponentChildNodes(transProp, child, xPath + child.getAttribute('name') + '/', absPath);
            }
         }
         child = child.nextSibling;
      }
   }

   /**
    * Ищет в конфигурации переводные свойства
    * @param {Object} object - входящий объект
    * @param {Array} xPath - путь до свойства
    * @param absPath
    */
   function findWordsInCfg(object, xPath, absPath) {
      var firstSymbol = xPath[0][0],
         option = (firstSymbol === '@' || firstSymbol === '$') ? xPath[0].slice(1) : xPath[0],
         val = object[option],
         i, len;

      if (!val) {
         return;
      }

      if (firstSymbol == '@' && Array.isArray(val)) {
         //Свойство будет массивом
         for (i = 0, len = val.length; i < len; i++) {
            if (xPath.length === 1) {
               pushKey(val[i], '', absPath);
            } else {
               findWordsInCfg(val[i], xPath.slice(1), absPath);
            }
         }
      } else if (firstSymbol == '$') {
         // Это html, его надо распарсить как дом
         val = findWordsInDOM(val, absPath);
         if (val) {
            object[option] = val;
         }
      } else if (xPath.length > 1) {
         // Свойство объект
         findWordsInCfg(val, xPath.slice(1), absPath);
      } else {
         // Обычное свойсвто
         pushKey(val, '', absPath);
      }
   }

   module.exports = {
      createResultDict: function(g, task) {
         if (!g) {
            return;
         } else {
            grunt = g;
         }

         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается построение результирующего словаря.');
         // Нужные еще опции --out и --modules
         var out = grunt.option('out').replace(/"/g, ''),
             modules = grunt.option('modules').replace(/"/g, ''),
             cloud = grunt.option('cloud').replace(/"/g, '');

         if (!out) {
            grunt.fail.fatal('Parameter "out" is not find');
            return;
         }

         if (!modules) {
            grunt.fail.fatal('Parameter "modules" is not find');
            return;
         }

         var done = task.async();

         // Считаем что builder лужит в jinnee в папке distrib\builder\
         // А папка ws в корне jinnee
         ws = 'd:/jinnee/ws/';
         jsonOutput = 'd:/jinnee/data/temp-' + uuid.v4();

         genJsDoc(grunt, cloud, ws, jsonOutput, function(error) {
            if (error) {
               grunt.log.error(error);
            }

            var paths = modules.split(';'),
                i, len;

            // Теперь в параметре modules может быть и путь до файла json
            if (paths.length == 1 && grunt.file.isFile(modules)) {
               try {
                  paths = grunt.file.readJSON(modules);
                  if (!Array.isArray(paths)) {
                     grunt.log.error('Parameter "modules" incorrect');
                     return;
                  }
               } catch(e) {
                  grunt.log.error('Parameter "modules" incorrect. Can\'t read ' + modules);
                  return;
               }
            }

            //paths.push(ws); // ws тоже запихиваем, а то теперь нам его не передают

            // Надо пройтись по всем путям, и найти компоненты
            for (i = 0, len = paths.length; i < len; i++) {
               if (!paths[i]) continue;
               cwd = paths[i];
               try {
                  findComponentsAndProperties(paths[i]);
               } catch(e) {
                  grunt.log.error(e);
               }
            }

            // Теперь еще раз проходимся по модулям и ищем xhtml файлы, когда уже есть все компоненты
            for (i = 0, len = paths.length; i < len; i++) {
               if (!paths[i]) continue;
               cwd = paths[i];
               try {
                  findWordsInXHTML(paths[i]);
               } catch(e) {
                  grunt.log.error(e);
               }
            }

            // Записать в результирующий словарь
            if (grunt.file.isDir(path.dirname(out))) {
               grunt.file.write(out, JSON.stringify(words, null, 2));
            } else {
               grunt.fail.warn('Could\'t create output file ' + out);
            }

            grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Построение результирующего словаря выполнено.');

            done();
         });
      }
   }
})();