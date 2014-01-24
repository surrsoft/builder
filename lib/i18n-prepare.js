/**
 * Created by ShilovDA on 11.10.13.
 */

var path = require('path'),
    xmlDom = require('../node_modules/grunt-packer/node_modules/tensor-xmldom'),
    DOMParser = xmlDom.DOMParser,
    XMLSerializer = xmlDom.XMLSerializer,
    parser = new DOMParser(),
    serializer = new XMLSerializer();

(function () {

   "use strict";

   var optTags = ['option', 'opt', 'options', 'opts'],
       components = [],
       componentsProperties = [],
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
    * Ищет все компоненты и их свойства в папке --root + --application
    */
   function findComponentsAndProperties() {
      var sourceFiles = grunt.file.expand(['**/*.module.js']),
          text, modName;

      sourceFiles.forEach(function(pathToSource) {
         // Вычитаем файл с модулем, и найдем в нем название модуля
         text = grunt.file.read(pathToSource);
         if (text) {
            modName = (modName = text.match(/define\(.*?["']js!(\S+)["']/)) ? modName[1] : false;
            if (modName && !components[modName]) {
               components[modName] = pathToSource;
               // Здесь же получим свойства компонента
               readPropertiesJSON(pathToSource.replace('.module.js', '.json'), modName);
            }
         }
      });
   }

   /**
    * Проходит по DOM дереву и переводит простые текстовые ноды и компоненты
    * @param {String} text - текст из xhtml файла
    * @returns String
    */
   function translateDOM(text) {
      var dom;
      try {
         dom = parser.parseFromString(text, 'text/html');
         enumChildNodes(dom);
      } catch(e) {
         grunt.log.error('Can\'t parse DOM' + e);
         return '';
      }

      return serializer.serializeToString(dom);
   }

   /**
    * Перебрать все дочерние узлы
    * @param node
    */
   function enumChildNodes(node) {
      if (node.nodeType == 1 || node.nodeType == 9) {
         var child = node.firstChild;
         while (child) {
            if(child.nodeType == 1) {
               if (child.hasAttribute('title')) {
                  child.setAttribute('title', addTranslateTagToText(child.getAttribute('title')));
               }

               if (child.localName !== 'component') {
                  enumChildNodes(child);
               } else {
                  translateComponent(child);
               }
            } else if (child.nodeType == 3) {
               if (child.nodeValue && /\S/.test(child.nodeValue) && optTags.indexOf(child.parentNode.localName) === -1) {
                  child.data = addTranslateTagToText(child.nodeValue);
               }
            }
            child = child.nextSibling;
         }
      }
   }

   /**
    * Перебирает все теги option и options
    * @param transProp
    * @param node
    * @param xPath
    */
   function enumComponentChildNodes(transProp, node, xPath) {
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
                     child.setAttribute('value', addTranslateTagToText(value));
                  } else {
                     child.innerHTML = addTranslateTagToText(child.innerHTML);
                  }
                  break;
               } else if (transProp[i] === xPath + '$' + name) {
                  // Если опция контент и переводится
                  if (value) {
                     child.setAttribute('value', translateDOM(value));
                  } else {
                     enumChildNodes(child);
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
                              childNode.setAttribute('value', addTranslateTagToText(childNode.getAttribute('value')));
                           } else {
                              childNode.innerHTML = addTranslateTagToText(childNode.innerHTML);
                           }
                        } else if (isSimple === false && (childLocalName == 'options' || childLocalName == 'opts')) {
                           enumComponentChildNodes(transProp, childNode, pp + '/');
                        }
                     }
                  }
               }
            } else {
               enumComponentChildNodes(transProp, child, xPath + child.getAttribute('name') + '/');
            }
         }
         child = child.nextSibling;
      }
   }

   /**
    * Перебирает компонент, ищет переводные свойства в аттрибуте config и перводит теги
    * @param node - элемент компонента
    */
   function translateComponent(node) {
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
                  translateCfg(cfg, transProp[i].split('/').slice(1));
               }

               node.setAttribute('config', JSON.stringify(cfg));
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
               translateComponent(child);
            }
            child = child.nextSibling;
         }

         // Теперь займемся опциями
         enumComponentChildNodes(transProp, node, '/');
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
                  compPath = components[modName.substr(0, firstSlash)].replace(/\/[a-zA-Z\.]+\.module\.js$/, ''),
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
    * Ищет в конфигурации переводные свойства
    * @param {Object} object - входящий объект
    * @param {Array} xPath - путь до свойства
    */
   function translateCfg(object, xPath) {
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
               val[i] = addTranslateTagToText(val[i]);
            } else {
               translateCfg(val[i], xPath.slice(1));
            }
         }
      } else if (firstSymbol == '$') {
         // Это html, его надо распарсить как дом
         val = translateDOM(val);
         if (val) {
            object[option] = val;
         }
      } else if (xPath.length > 1) {
         // Свойство объект
         translateCfg(val, xPath.slice(1));
      } else {
         // Обычное свойсвто
         object[option] = addTranslateTagToText(val);
      }
   }

   /**
    * Добавляет теги шаблонизатора к тексту, для перевода
    * @param text - текст для обрамления {[ ]}
    * @returns String
    */
   function addTranslateTagToText(text) {
      var temp = text.trim();
      if (/^{\[[\S\s]*\]}$/.test(temp) || /^{{[\S\s]*}}$/.test(temp)) {
         return text;
      }

      if (!temp) {
         return text;
      }

      return '{[' + temp + ']}';
   }

   module.exports = {
      /**
       * Подготавливаем ресурсы к переводу
       * Находит все xhtml файлы, разбирает их, и выискивает слова для перевода
       * Нужные слова обрамляет {[  ]}, для перевода с помощью шаблонизатора
       * Работаем по алгоритму:
       * 1 - ищем все xhtml файлы
       * 2 - разбираем их, и выискиваем простые текстовые ноды и компоненты
       * 3 - простые текстовые ноды просто обрамляем {[]}
       * 4 - Для компонента ищем его json файл с описанием
       * 5 - Если нашли файл с описанием, переводим внутренности, которые того требуют и уходим в глубь
       * @param g
       * @param application
       */
      prepareXHTML: function(g, application) {
         var text;

         if (!g) {
            return;
         } else {
            grunt = g;
         }

         // Сначала надо найти все компоненты и пути до них
         findComponentsAndProperties();

         // Находим все xhtml файлы
         grunt.file.recurse(path.join('./', application), function(absPath, rootDir, subDir, fileName) {
            // Игнорируем файлы xhtml в ws
            if (/\.xhtml$/.test(fileName) && !(/^ws\//.test(absPath) || /\/ws\//.test(absPath))) {
               try {
                  grunt.log.ok(absPath);
                  text = grunt.file.read(absPath);
                  text = translateDOM(text);
                  if (text) {
                     grunt.file.write(absPath, text);
                  }
               } catch(e) {
                  grunt.log.error('Can\'t read ' + absPath);
               }
            }
         });
      }
   }
})();