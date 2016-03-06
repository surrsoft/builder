/**
 * Created by ShilovDA on 11.10.13.
 */
"use strict";

var
   path = require('path'),
   parser = require('./../utils/ParserUtilities'),
   fs = require('fs'),
   uuid = require('node-uuid'),
   genJsDoc = require('./../jsDoc/generateJsDoc');

var
   isDoT1 = /{\[[\S\s]*]}/,
   isDoT2 = /{{[\S\s]*|[\S\s]*}}/,
   isComment = /^<!--?[\s\S]*?-?->$/,
   isDirective = /%{\w+ [\s\S]+}/,
   isDoctype = /!DOCTYPE/,
   isAMD = /define[\S\s]*?\([\S\s]*?["']js!([A-Za-z0-9\.]+)["']/,
   notSpace = /\S/,
   isArray = /Array|array/,
   isContent = /Content|content/;

(function () {
   var
      optTags = ['option', 'opt', 'options', 'opts'],
      components = {},
      componentsProperties = {},
      jsonOutput,
      grunt;

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
    * Добавляет теги шаблонизатора к тексту, для перевода
    * @param text - текст для обрамления {[ ]}
    * @returns String
    */
   function addTranslateTagToText(text) {
      var temp = text.trim();

      if (!temp || isDoT1.test(temp) || isDoT2.test(temp) || isComment.test(temp) || isDirective.test(temp) || isDoctype.test(temp)) {
         return text;
      }

      return text.replace(temp, '{[' + temp + ']}');
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
            modName = (modName = text.match(isAMD)) ? modName[1] : false;
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
         dom = parser.parse(text);
         enumChildNodes(dom);
      } catch(e) {
         grunt.log.error('Can\'t parse DOM ' + e, e.stack);
         return '';
      }

      return dom.outerHTML();
   }

   /**
    * Перебрать все дочерние узлы
    * @param node
    * @param considerTheCurrentNode
    */
   function enumChildNodes(node, considerTheCurrentNode) {
      function currentNode(node) {
         if(node.nodeType == 1 && node.nodeName.toLocaleLowerCase() !== 'script') {
            if (node.hasAttribute('title')) {
               node.setAttribute('title', addTranslateTagToText(node.getAttribute('title')));
            }

            if (node.nodeName !== 'component') {
               enumChildNodes(node);
            } else {
               translateComponent(node);
            }
         } else if (node.nodeType == 3) {
            if (node.nodeValue && notSpace.test(node.nodeValue) && optTags.indexOf(node.parentNode.nodeName) === -1) {
               node.nodeValue = addTranslateTagToText(node.nodeValue);
            }
         }
      }

      if (considerTheCurrentNode) {
         currentNode(node);
      }

      if (node.nodeType == 1 || node.nodeType == 9) {
         var child = node.firstChild;
         while (child) {
            currentNode(child);
            child = child.nextSibling;
         }
      }
   }

   /**
    * Перебирает компонент, ищет переводные свойства в аттрибуте config и перводит теги
    * @param node - элемент компонента
    */
   function translateComponent(node) {
      // Для компонента надо вытащить его имя, и найти файл со свойствами
      var
         moduleName = node.getAttribute('data-component'),
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
            if (child.nodeType === 1 && child.nodeName == 'component') {
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
    * @param moduleName
    */
   function propertiesParser(transPropXPath, object, propPath, moduleName) {
      if (!object) {
         return;
      }

      Object.keys(object).forEach(function(key) {
         var elem = object[key],
            isCompType = isArray.test(elem.type) ? '@' : isContent.test(elem.type) ? '$' : '';

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
    */
   function enumComponentChildNodes(transProp, node, xPath) {
      var
         child = node.firstChild,
         i, len;

      while (child) {
         // Только теги опций
         if (child.nodeType != 1 || optTags.indexOf(child.nodeName) == -1) {
            // Делаем допущение для обычных html тегов, их тоже подготавливаем
            enumChildNodes(child, true);
            child = child.nextSibling;
            continue;
         }

         var
            nodeName = child.nodeName,
            name = child.hasAttribute('name') ? child.getAttribute('name') : '',
            value = child.hasAttribute('value') ? child.getAttribute('value') : '',
            type = child.hasAttribute('type') ? child.getAttribute('type') : '';

         // Здесь либо option, либо options, либо components, остальное игнорим
         if (nodeName == 'option' || nodeName == 'opt') {
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
         } else if (nodeName == 'options' || nodeName == 'opts') {
            if (isArray.test(type)) {
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
                         childNodeName = childNode.nodeName;
                     if (childNode.nodeType == 1) {
                        if (isSimple === true && (childNodeName == 'option' || childNodeName == 'opt')) {
                           if (childNode.hasAttribute('value')) {
                              childNode.setAttribute('value', addTranslateTagToText(childNode.getAttribute('value')));
                           } else {
                              childNode.innerHTML = addTranslateTagToText(childNode.innerHTML);
                           }
                        } else if (isSimple === false && (childNodeName == 'options' || childNodeName == 'opts')) {
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
    * Ищет в конфигурации переводные свойства
    * @param {Object} object - входящий объект
    * @param {Array} xPath - путь до свойства
    */
   function translateCfg(object, xPath) {
      var
         firstSymbol = xPath[0][0],
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
       * @param data
       * @param done
       */
      prepareXHTML: function(g, data, done) {
         var text;

         if (!g) {
            return;
         } else {
            grunt = g;
         }

         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Подготавливаем xhtml файлы для локализации.');

         var modules = grunt.option('modules').replace(/"/g, '');

         // Считаем что builder лужит в jinnee в папке distrib\builder\
         jsonOutput = path.join(__dirname, '../../../../jsDoc-json-cache');

         genJsDoc(grunt, modules, jsonOutput, function(error) {
            if (error) {
               grunt.log.error(error);
            }

            // Сначала надо найти все компоненты и пути до них
            grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Ищем модули и их свойства для локализации');
            findComponentsAndProperties();
            grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Поиск модулей и их свойств для локализации выполнен');

            // Находим все xhtml файлы
            grunt.file.recurse(path.join('./', data.application), function(absPath, rootDir, subDir, fileName) {
               // Игнорируем файлы xhtml в ws
               if (/\.xhtml$/.test(fileName) && !(/^ws\//.test(absPath) || /\/ws\//.test(absPath))) {
                  try {
                     grunt.log.debug(absPath);
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

            grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Подготовка xhtml файлов для локализации выполнена.');

            done();
         });
      }
   }
})();