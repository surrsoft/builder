/**
 * Created by shilovda on 11.10.13.
 */

var path = require('path'),
    xmldom = require('tensor-xmldom'),
    DOMParser = xmldom.DOMParser,
    parser = new DOMParser();

(function () {

   "use strict";

   var optTags = ['option', 'opt', 'options', 'opts'],
       components = [],
       componentsProperties = [],
       words = [],
       grunt;

   /**
    * Вычитывает файл со свойствами контрола
    * @param {String} modPath - путь до файла
    * @param {String} modName - название контрола
    */
   function readPropertiesJSON(modPath, modName) {
      if (!grunt.file.exists(modPath)) {
         return;
      }

      var properties;
      try {
         properties = grunt.file.readJSON(modPath);
      } catch(e) {
         grunt.log.error('Can\'t read ' + modPath);
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
         module: path.dirname(module)
      });
   }

   /**
    *
    * @param cwd
    */
   function findComponentsAndProperties(cwd) {
      var sourceFiles = grunt.file.expand({cwd:cwd}, ['**/*.module.js']),
          absPath, text, modName;

      sourceFiles.forEach(function(pathToSource) {
         // Вычитаем файл с модулем, и найдем в нем название модуля
         absPath = path.join(cwd, pathToSource);
         text = grunt.file.read(absPath);
         if (text) {
            modName = (modName = text.match(/define[\S\s]*?\([\S\s]*?["']js!([A-Za-z0-9\.]+)["']/)) ? modName[1] : false;
            if (modName && !components[modName]) {
               components[modName] = absPath;
               // Здесь же получим свойства компонента
               readPropertiesJSON(absPath.replace('.module.js', '.json'), modName);
               readWordsInModule(absPath, text);
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
               findWordsInDOM(text, absPath);
            }
         }
      });
   }

   /**
    *
    * @param text
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
    *
    * @param node
    * @param absPath
    */
   function enumChildNodes(node, absPath) {
      if (node.nodeType == 1 || node.nodeType == 9) {
         var child = node.firstChild;
         while (child) {
            if(child.nodeType == 1) {
               if (child.hasAttribute('title')) {
                  pushKey(child.getAttribute('title'), '', absPath);
               }

               if (child.localName !== 'component') {
                  enumChildNodes(child, absPath);
               } else {
                  findWordsInComponent(child, absPath);
               }
            } else if (child.nodeType == 3) {
               if (child.nodeValue && /\S/.test(child.nodeValue) && optTags.indexOf(child.parentNode.localName) === -1) {
                  pushKey(child.nodeValue, '', absPath);
               }
            }
            child = child.nextSibling;
         }
      }
   }

   /**
    *
    * @param node
    * @param absPath
    */
   function findWordsInComponent(node, absPath) {
      // Для компонента надо вытащить его имя, и найти файл со свойствами
      var moduleName = node.getAttribute('data-component'),
          cfg = node.getAttribute('config') || '{}',
          properties = componentsProperties[moduleName],
          transProp = [];

      if (properties && Object.keys(properties).length && properties.properties && properties.properties["ws-config"]) {
         propertiesParser(transProp, properties.properties["ws-config"].options, "");
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
    *
    * @param transPropXPath
    * @param object
    * @param propPath
    */
   function propertiesParser(transPropXPath, object, propPath) {
      if (!object) {
         return;
      }

      Object.keys(object).forEach(function(key) {
         var elem = object[key],
            isCompType = /Array|array/.test(elem.type) ? '@' : /Content|content/.test(elem.type) ? '$' : '';

         if (elem.options) {
            propertiesParser(transPropXPath, elem.options, propPath + '/' + isCompType + key);
         } else if (elem.itemType || components[elem.type]) {
            var properties = componentsProperties[elem.itemType || elem.type];
            if (!properties && elem.itemType) {
               var modName = elem.itemType,
                   firstSlash = modName.indexOf('/'),
                   compPath = components[modName.substr(0, firstSlash)].replace(/\\[a-zA-Z\.]+\.module\.js$/, ''),
                   modPath = path.join(compPath, modName.substring(firstSlash)) +  '.json';
               if (firstSlash !== -1) {
                  readPropertiesJSON(modPath, modName);
                  properties = componentsProperties[modName];
               }
            }

            if (properties && Object.keys(properties).length && properties.properties && properties.properties["ws-config"]) {
               propertiesParser(transPropXPath, properties.properties["ws-config"].options, propPath + '/' + isCompType + key);
            }
         } else if (elem.translatable) {
            transPropXPath.push(propPath + '/' + isCompType + key);
         }
      });
   }

   /**
    *
    * @param object
    * @param xPath
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

   /**
    *
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
         if (child.nodeType != 1 && optTags.indexOf(child.localName) == -1) {
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

   module.exports = {
      createResultDict: function(g) {
         if (!g) {
            return;
         } else {
            grunt = g;
         }

         // Нужные еще опции --out и --modules
         var out = grunt.option('out'),
             modules = grunt.option('modules');

         if (!out) {
            grunt.log.error('Parameter "out" is not find');
            return;
         }

         if (!modules) {
            grunt.log.error('Parameter "modules" is not find');
            return
         }

         var paths = modules.split(';'),
             i, len;

         // Надо пройтись по всем путям, и найти компоненты
         for (i = 0, len = paths.length; i < len; i++) {
            if (!paths[i]) continue;
            try {
               findComponentsAndProperties(paths[i]);
            } catch(e) {
               grunt.log.error(e);
            }
         }

         // Теперь еще раз проходимся по модулям и ищем xhtml файлы, когда уже есть все компоненты
         for (i = 0, len = paths.length; i < len; i++) {
            if (!paths[i]) continue;
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
            grunt.fail.error('Could\'t create file ' + out);
         }
      }
   }
})();